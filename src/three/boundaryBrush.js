import {
  BufferAttribute,
  BufferGeometry,
  Line,
  LineBasicMaterial,
  Matrix4,
  Raycaster,
  Vector2,
  Vector3,
} from 'three'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry'

const PREVIEW_COLOR = 0x00FF88
// const LINE_WIDTH = 3
const SNAP_DISTANCE = 5 // max distance from boundary (in mm) to start a stroke

/**
 * Boundary Draw Brush — lets the user freehand-draw a stroke that replaces
 * a segment of a smoothed boundary loop, then blends the junction.
 *
 * Stroke points are obtained by raycasting the mesh surface. Off-surface
 * points are ignored so only effective contour edits are previewed/applied.
 */
export class BoundaryBrush {
  /**
   * @param {object} opts
   * @param {HTMLElement} opts.domElement
   * @param {THREE.Camera} opts.camera
   * @param {THREE.Scene} opts.scene
   * @param {Function} opts.render
   * @param {Function} opts.setOrbitEnabled
   * @param {Function} opts.setDragEnabled
   * @param {Function} opts.getModels - returns array of model meshes for raycasting
   */
  constructor({ domElement, camera, scene, render, setOrbitEnabled, setDragEnabled, getModels, brushCursor }) {
    this._dom = domElement
    this._camera = camera
    this._scene = scene
    this._render = render
    this._setOrbitEnabled = setOrbitEnabled
    this._setDragEnabled = setDragEnabled
    this._getModels = getModels
    this._brushCursor = brushCursor || 'crosshair'
    this._idleCursor = ''
    this._lastHoverCursor = null

    // Working copy of loop data (array of { points: [[x,y,z],...] })
    this._workingLoops = null
    // Line2 objects currently in the scene (one per loop)
    this._lines = null
    // PCA basis vectors for 2D projection (used by closed-stroke anti-kink)
    this._uAxis = null
    this._vAxis = null
    this._centroid = null

    // Stroke state
    this._drawing = false
    this._strokePoints = [] // Vector3[]
    this._previewLine = null
    this._persistedLines = [] // keep drawn strokes visible

    // Raycaster
    this._raycaster = new Raycaster()

    // Bound handlers (capture phase — fires before bubble-phase SelectionManager / DragControl)
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onPointerHover = this._onPointerHover.bind(this)

    /** @type {Function|null} called after each stroke merge */
    this.onStrokeApplied = null
  }

  /**
   * Activate the brush on the given boundary lines and loop data.
   * @param {Line2[]} lines - existing Line2 objects in the scene
   * @param {Array<{points: number[][]}>} loopData - smoothed loop data
   */
  init(lines, loopData) {
    // Deep copy loop data so we can mutate freely
    this._workingLoops = loopData.map(l => ({
      points: l.points.map(p => [p[0], p[1], p[2]]),
    }))
    this._lines = lines

    // Compute PCA plane from all boundary points
    this._computeBoundaryPlane()

    this._setDragEnabled(false)

    this._idleCursor = this._dom.style.cursor || ''
    this._dom.addEventListener('pointerdown', this._onPointerDown, true)
    this._dom.addEventListener('pointermove', this._onPointerHover)
    this._dom.addEventListener('pointerleave', this._onPointerHover)
  }

  /** Deactivate the brush, clean up listeners and preview geometry. */
  dispose() {
    this._dom.removeEventListener('pointerdown', this._onPointerDown, true)
    this._dom.removeEventListener('pointermove', this._onPointerHover)
    this._dom.removeEventListener('pointerleave', this._onPointerHover)
    this._dom.style.cursor = this._idleCursor
    this._lastHoverCursor = null
    this._detachDragListeners()
    this._removePreviewLine()
    for (const line of this._persistedLines) {
      this._scene.remove(line)
      line.geometry.dispose()
      line.material.dispose()
    }
    this._persistedLines = []
    this._setOrbitEnabled(true)
    this._setDragEnabled(true)
    this._drawing = false
    this._workingLoops = null
    this._lines = null
  }

  // ─── PCA Plane ──────────────────────────────────────────

  _computeBoundaryPlane() {
    // Collect all points
    const pts = []
    for (const loop of this._workingLoops) {
      for (const p of loop.points) {
        pts.push(new Vector3(p[0], p[1], p[2]))
      }
    }
    if (pts.length < 3)
      return

    // Centroid
    const centroid = new Vector3()
    for (const p of pts) centroid.add(p)
    centroid.divideScalar(pts.length)
    this._centroid = centroid

    // Covariance matrix (3x3 symmetric)
    let xx = 0; let xy = 0; let xz = 0; let yy = 0; let yz = 0; let zz = 0
    for (const p of pts) {
      const dx = p.x - centroid.x
      const dy = p.y - centroid.y
      const dz = p.z - centroid.z
      xx += dx * dx; xy += dx * dy; xz += dx * dz
      yy += dy * dy; yz += dy * dz; zz += dz * dz
    }
    const n = pts.length
    const cov = [
      [xx / n, xy / n, xz / n],
      [xy / n, yy / n, yz / n],
      [xz / n, yz / n, zz / n],
    ]

    // Power iteration to find eigenvectors (largest → smallest)
    const normal = this._smallestEigenvector(cov)

    // Build orthonormal basis on the plane
    const tmp = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
    this._uAxis = new Vector3().crossVectors(normal, tmp).normalize()
    this._vAxis = new Vector3().crossVectors(normal, this._uAxis).normalize()
  }

  /**
   * Find the eigenvector with the smallest eigenvalue of a 3×3 symmetric matrix
   * using power iteration + deflation.
   */
  _smallestEigenvector(cov) {
    const powerIteration = (mat, iters = 80) => {
      let v = [Math.random() + 0.1, Math.random() + 0.1, Math.random() + 0.1]
      for (let i = 0; i < iters; i++) {
        const nv = [
          mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2],
          mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2],
          mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2],
        ]
        const len = Math.sqrt(nv[0] * nv[0] + nv[1] * nv[1] + nv[2] * nv[2])
        if (len < 1e-12)
          break
        v = [nv[0] / len, nv[1] / len, nv[2] / len]
      }
      const Av = [
        mat[0][0] * v[0] + mat[0][1] * v[1] + mat[0][2] * v[2],
        mat[1][0] * v[0] + mat[1][1] * v[1] + mat[1][2] * v[2],
        mat[2][0] * v[0] + mat[2][1] * v[1] + mat[2][2] * v[2],
      ]
      const eigenvalue = v[0] * Av[0] + v[1] * Av[1] + v[2] * Av[2]
      return { eigenvalue, eigenvector: v }
    }

    const deflate = (mat, eigenvalue, ev) => {
      const m = mat.map(row => [...row])
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          m[i][j] -= eigenvalue * ev[i] * ev[j]
        }
      }
      return m
    }

    const e1 = powerIteration(cov)
    const cov2 = deflate(cov, e1.eigenvalue, e1.eigenvector)
    const e2 = powerIteration(cov2)
    const cov3 = deflate(cov2, e2.eigenvalue, e2.eigenvector)
    const e3 = powerIteration(cov3)

    const candidates = [e1, e2, e3]
    candidates.sort((a, b) => a.eigenvalue - b.eigenvalue)
    const v = candidates[0].eigenvector
    return new Vector3(v[0], v[1], v[2]).normalize()
  }

  // ─── Raycasting helpers ─────────────────────────────────

  _getNdc(event) {
    const rect = this._dom.getBoundingClientRect()
    return new Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  /** Raycast pointer onto the model mesh surface; returns Vector3 or null. */
  _raycastMeshSurface(event) {
    const models = this._getModels()
    if (!models || models.length === 0)
      return null
    const ndc = this._getNdc(event)
    this._raycaster.setFromCamera(ndc, this._camera)
    const intersects = this._raycaster.intersectObjects(models, true)
    return intersects.length > 0 ? intersects[0].point : null
  }

  /** Find nearest point index on a loop to a given 3D point. */
  _nearestPointOnLoop(loop, point) {
    let bestDist = Infinity
    let bestIdx = -1
    for (let i = 0; i < loop.length; i++) {
      const p = loop[i]
      const dx = p[0] - point.x; const dy = p[1] - point.y; const dz = p[2] - point.z
      const d = dx * dx + dy * dy + dz * dz
      if (d < bestDist) { bestDist = d; bestIdx = i }
    }
    return { index: bestIdx, distSq: bestDist }
  }

  // ─── Pointer events (capture phase) ────────────────────

  _onPointerHover(event) {
    // While a stroke is in progress the drawing cursor is already correct.
    if (this._drawing)
      return
    // pointerleave: pull the brush cursor off the canvas.
    if (event.type === 'pointerleave') {
      if (this._lastHoverCursor !== this._idleCursor) {
        this._dom.style.cursor = this._idleCursor
        this._lastHoverCursor = this._idleCursor
      }
      return
    }
    const meshHit = this._raycastMeshSurface(event)
    const next = meshHit ? this._brushCursor : this._idleCursor
    if (next !== this._lastHoverCursor) {
      this._dom.style.cursor = next
      this._lastHoverCursor = next
    }
  }

  _onPointerDown(event) {
    // Adjustment mode owns brush activation, so left-click starts directly.
    if (event.button !== 0)
      return
    if (!this._workingLoops)
      return

    const meshHit = this._raycastMeshSurface(event)
    if (!meshHit)
      return

    // Check if near any boundary loop
    let bestLoopIdx = -1
    let bestDist = Infinity
    for (let li = 0; li < this._workingLoops.length; li++) {
      const { distSq } = this._nearestPointOnLoop(this._workingLoops[li].points, meshHit)
      if (distSq < bestDist) {
        bestDist = distSq
        bestLoopIdx = li
      }
    }

    if (bestDist > SNAP_DISTANCE * SNAP_DISTANCE)
      return

    // Only swallow the pointer sequence once a brush stroke actually starts.
    // Other drags remain available to OrbitControls while contour adjustment is active.
    event.stopImmediatePropagation()
    event.preventDefault()

    this._drawing = true
    this._activeLoopIndex = bestLoopIdx
    this._strokePoints = [meshHit.clone()]

    this._createPreviewLine(meshHit)

    this._setOrbitEnabled(false)
    // Register move/up on document (capture) so we always receive events
    // even if the cursor briefly leaves the canvas or pointer-capture
    // routing misbehaves.
    document.addEventListener('pointermove', this._onPointerMove, true)
    document.addEventListener('pointerup', this._onPointerUp, true)
    document.addEventListener('pointercancel', this._onPointerUp, true)
    try {
      this._dom.setPointerCapture(event.pointerId)
    }
    catch {}
  }

  _detachDragListeners() {
    document.removeEventListener('pointermove', this._onPointerMove, true)
    document.removeEventListener('pointerup', this._onPointerUp, true)
    document.removeEventListener('pointercancel', this._onPointerUp, true)
  }

  _onPointerMove(event) {
    if (!this._drawing)
      return

    event.stopImmediatePropagation()
    event.preventDefault()

    const meshHit = this._raycastMeshSurface(event)
    if (!meshHit)
      return

    this._strokePoints.push(meshHit.clone())
    this._updatePreviewLine()
    this._render()
  }

  _onPointerUp(event) {
    if (!this._drawing)
      return

    event.stopImmediatePropagation()
    event.preventDefault()

    this._drawing = false
    this._setOrbitEnabled(true)
    this._detachDragListeners()
    try {
      this._dom.releasePointerCapture(event.pointerId)
    }
    catch {}

    if (this._strokePoints.length < 3) {
      this._removePreviewLine()
      this._render()
      return
    }

    this._mergeStroke(this._activeLoopIndex, this._strokePoints)
    this._removePreviewLine()
    this._render()
  }

  // ─── Preview Line ──────────────────────────────────────

  _createPreviewLine(startPoint) {
    // Plain THREE.Line with a pre-allocated, growable position buffer.
    // We avoid Line2 here because the InstancedBufferGeometry behind it
    // doesn't always upload buffer changes mid-frame on every driver.
    const MAX_PTS = 4096
    const positions = new Float32Array(MAX_PTS * 3)
    positions[0] = startPoint.x
    positions[1] = startPoint.y
    positions[2] = startPoint.z
    positions[3] = startPoint.x
    positions[4] = startPoint.y
    positions[5] = startPoint.z

    const geometry = new BufferGeometry()
    const attr = new BufferAttribute(positions, 3)
    attr.setUsage(35048) // DynamicDrawUsage
    geometry.setAttribute('position', attr)
    geometry.setDrawRange(0, 2)

    const material = new LineBasicMaterial({
      color: PREVIEW_COLOR,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    })

    const line = new Line(geometry, material)
    line.renderOrder = 999
    line.frustumCulled = false
    this._previewLine = line
    this._previewBuffer = positions
    this._previewMaxPts = MAX_PTS
    this._scene.add(line)
  }

  _updatePreviewLine() {
    if (!this._previewLine || this._strokePoints.length < 2)
      return
    const buf = this._previewBuffer
    const max = this._previewMaxPts
    const n = Math.min(this._strokePoints.length, max)
    for (let i = 0; i < n; i++) {
      const p = this._strokePoints[i]
      const o = i * 3
      buf[o] = p.x
      buf[o + 1] = p.y
      buf[o + 2] = p.z
    }
    this._previewLine.geometry.attributes.position.needsUpdate = true
    this._previewLine.geometry.setDrawRange(0, n)
  }

  _removePreviewLine() {
    if (this._previewLine) {
      this._scene.remove(this._previewLine)
      this._previewLine.geometry.dispose()
      this._previewLine.material.dispose()
      this._previewLine = null
      this._previewBuffer = null
    }
  }

  // ─── Merge Algorithm ───────────────────────────────────

  _mergeStroke(loopIndex, strokeVec3s) {
    // Clean stroke self-intersections before merge
    const stroke = this._cleanStrokeSelfIntersections(strokeVec3s)
    if (stroke.length < 3)
      return

    const loop = this._workingLoops[loopIndex].points
    const N = loop.length

    const { index: iStart } = this._nearestPointOnLoop(loop, stroke[0])
    const { index: iEnd } = this._nearestPointOnLoop(loop, stroke[stroke.length - 1])

    // Detect closed stroke: iStart and iEnd map to same or nearby boundary point
    const fwdArc = (iEnd - iStart + N) % N
    const bwdArc = (iStart - iEnd + N) % N
    const shortArc = Math.min(fwdArc, bwdArc)

    let newLoop

    if (shortArc < 3) {
      // ── Closed stroke: concatenate full boundary + stroke, let anti-kink resolve ──
      newLoop = []
      for (let k = 0; k < N; k++) {
        const idx = (iStart + k) % N
        newLoop.push([loop[idx][0], loop[idx][1], loop[idx][2]])
      }
      for (let i = 1; i < stroke.length - 1; i++) {
        const p = stroke[i]
        newLoop.push([p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1], p.z !== undefined ? p.z : p[2]])
      }
      if (newLoop.length < 4)
        return
    }
    else {
      // ── Open stroke: replace the nearer arc ──
      const arc1 = this._extractArc(loop, iStart, iEnd)
      const arc2 = this._extractArc(loop, iEnd, iStart)

      const strokeMid = stroke[Math.floor(stroke.length / 2)]
      const d1 = this._dist3(strokeMid, arc1[Math.floor(arc1.length / 2)])
      const d2 = this._dist3(strokeMid, arc2[Math.floor(arc2.length / 2)])
      const keptArc = d1 < d2 ? arc2 : arc1

      // Ensure stroke direction: first point near keptArc end
      const arcEnd = keptArc[keptArc.length - 1]
      const arcStart = keptArc[0]
      const distFirst = this._dist3Arr(stroke[0], arcEnd)
      const distLast = this._dist3Arr(stroke[stroke.length - 1], arcEnd)
      if (distLast < distFirst)
        stroke.reverse()

      // Snap stroke endpoints to exact boundary junction positions
      stroke[0] = new Vector3(arcEnd[0], arcEnd[1], arcEnd[2])
      stroke[stroke.length - 1] = new Vector3(arcStart[0], arcStart[1], arcStart[2])

      // Build new loop: keptArc (without last) + stroke (without last)
      newLoop = []
      for (let i = 0; i < keptArc.length - 1; i++) {
        newLoop.push([keptArc[i][0], keptArc[i][1], keptArc[i][2]])
      }
      for (let i = 0; i < stroke.length - 1; i++) {
        const p = stroke[i]
        newLoop.push([p.x !== undefined ? p.x : p[0], p.y !== undefined ? p.y : p[1], p.z !== undefined ? p.z : p[2]])
      }

      if (newLoop.length < 3)
        return

      // Gentle junction blending — only ±3 points at each junction
      const j1 = keptArc.length - 1
      this._blendJunction(newLoop, j1, 3, 2)
      this._blendJunction(newLoop, 0, 3, 2)

      // Snap off-surface points near junctions back to mesh
      this._snapJunctionToSurface(newLoop, j1, 5)
      this._snapJunctionToSurface(newLoop, 0, 5)

      // Remove crossings/overlaps via 3D proximity
      this._removeProximityCrossings(newLoop, keptArc.length - 1, newLoop.length - 1)
    }

    // Anti-kink: only for closed strokes
    const cleaned = shortArc < 3 ? this._removeSelfIntersections(newLoop) : newLoop

    this._workingLoops[loopIndex].points = cleaned
    this._updateLineGeometry(loopIndex)

    if (this.onStrokeApplied) {
      this.onStrokeApplied(this._workingLoops)
    }
  }

  _extractArc(loop, fromIdx, toIdx) {
    const N = loop.length
    const arc = []
    let i = fromIdx
    while (true) {
      arc.push(loop[i])
      if (i === toIdx)
        break
      i = (i + 1) % N
    }
    return arc
  }

  _averageSpacing(loop) {
    let total = 0
    const N = loop.length
    for (let i = 0; i < N; i++) {
      const a = loop[i]
      const b = loop[(i + 1) % N]
      total += Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
    }
    return total / N
  }

  // ─── Junction Blending ────────────────────────────────

  _blendJunction(loop, junctionIndex, blendRadius = 5, iterations = 3) {
    const N = loop.length
    for (let iter = 0; iter < iterations; iter++) {
      const copy = loop.map(p => [p[0], p[1], p[2]])
      for (let offset = -blendRadius; offset <= blendRadius; offset++) {
        if (offset === 0)
          continue
        const i = ((junctionIndex + offset) % N + N) % N
        const prevI = ((i - 1) % N + N) % N
        const nextI = (i + 1) % N
        const t = 1 - Math.abs(offset) / (blendRadius + 1)
        const weight = t * 0.5
        const mx = (copy[prevI][0] + copy[nextI][0]) / 2
        const my = (copy[prevI][1] + copy[nextI][1]) / 2
        const mz = (copy[prevI][2] + copy[nextI][2]) / 2
        loop[i][0] = copy[i][0] + weight * (mx - copy[i][0])
        loop[i][1] = copy[i][1] + weight * (my - copy[i][1])
        loop[i][2] = copy[i][2] + weight * (mz - copy[i][2])
      }
    }
  }

  // ─── Anti-Kink: Self-Intersection Removal ─────────────

  _removeSelfIntersections(loop) {
    if (!this._uAxis || !this._vAxis || !this._centroid)
      return loop

    const coords2d = loop.map((p) => {
      const dx = p[0] - this._centroid.x
      const dy = p[1] - this._centroid.y
      const dz = p[2] - this._centroid.z
      return [
        this._uAxis.x * dx + this._uAxis.y * dy + this._uAxis.z * dz,
        this._vAxis.x * dx + this._vAxis.y * dy + this._vAxis.z * dz,
      ]
    })

    let result = [...loop]
    let result2d = [...coords2d]
    let changed = true

    while (changed) {
      changed = false
      const N = result.length
      if (N < 4)
        break

      outer:
      for (let i = 0; i < N; i++) {
        const i2 = (i + 1) % N
        for (let j = i + 2; j < N; j++) {
          if (i === 0 && j === N - 1)
            continue
          const j2 = (j + 1) % N
          if (this._segmentsIntersect2D(result2d[i], result2d[i2], result2d[j], result2d[j2])) {
            const sub1 = []; const sub1_2d = []
            for (let k = i2; ; k = (k + 1) % N) {
              sub1.push(result[k])
              sub1_2d.push(result2d[k])
              if (k === j)
                break
            }
            const sub2 = []; const sub2_2d = []
            for (let k = j2; ; k = (k + 1) % N) {
              sub2.push(result[k])
              sub2_2d.push(result2d[k])
              if (k === i)
                break
            }

            if (Math.abs(this._signedArea2D(sub1_2d)) >= Math.abs(this._signedArea2D(sub2_2d))) {
              result = sub1
              result2d = sub1_2d
            }
            else {
              result = sub2
              result2d = sub2_2d
            }
            changed = true
            break outer
          }
        }
      }
    }

    return result
  }

  _segmentsIntersect2D(a1, a2, b1, b2) {
    const d1x = a2[0] - a1[0]; const d1y = a2[1] - a1[1]
    const d2x = b2[0] - b1[0]; const d2y = b2[1] - b1[1]
    const denom = d1x * d2y - d1y * d2x
    if (Math.abs(denom) < 1e-12)
      return false

    const dx = b1[0] - a1[0]; const dy = b1[1] - a1[1]
    const t = (dx * d2y - dy * d2x) / denom
    const u = (dx * d1y - dy * d1x) / denom
    return t > 1e-8 && t < 1 - 1e-8 && u > 1e-8 && u < 1 - 1e-8
  }

  _signedArea2D(pts) {
    let area = 0
    const N = pts.length
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N
      area += pts[i][0] * pts[j][1] - pts[j][0] * pts[i][1]
    }
    return area / 2
  }

  // ─── Post-Merge Surface Snap ─────────────────────────

  /**
   * Snap points near a junction back onto the model mesh surface.
   * Uses the model's BVH closestPointToPoint for accurate projection.
   */
  _snapJunctionToSurface(loop, junctionIdx, radius) {
    const models = this._getModels()
    if (!models || models.length === 0)
      return

    const model = models[0]
    const bvh = model.geometry?.boundsTree
    if (!bvh)
      return

    const invMatrix = new Matrix4().copy(model.matrixWorld).invert()
    const worldMatrix = model.matrixWorld
    const N = loop.length
    const localPt = new Vector3()
    const target = { point: new Vector3(), distance: 0, faceIndex: 0 }
    // Average edge length near junction for distance threshold
    const threshold = this._averageSpacing(loop) * 2

    for (let offset = -radius; offset <= radius; offset++) {
      const i = ((junctionIdx + offset) % N + N) % N
      const p = loop[i]
      localPt.set(p[0], p[1], p[2]).applyMatrix4(invMatrix)
      bvh.closestPointToPoint(localPt, target)

      if (target.distance > threshold) {
        // Snap to surface
        const worldPt = target.point.clone().applyMatrix4(worldMatrix)
        loop[i] = [worldPt.x, worldPt.y, worldPt.z]
      }
    }
  }

  // ─── Post-Merge 3D Proximity Crossing Fix ────────────

  /**
   * Detect crossings and overlaps using 3D proximity:
   * if two points are close in 3D but far along the loop, there's a
   * crossing or doubling-back. Remove the shorter sub-loop between them.
   * Only checks stroke-region points against all other points.
   */
  _removeProximityCrossings(loop, strokeStart, strokeEnd) {
    const minSep = 5 // minimum index separation to consider
    const avgSp = this._averageSpacing(loop)
    const thresholdSq = (avgSp * 2) ** 2

    let changed = true
    while (changed) {
      changed = false
      const N = loop.length
      if (N < minSep * 2)
        break

      // Clamp strokeEnd to current loop size
      const sEnd = Math.min(strokeEnd, N - 1)

      for (let si = strokeStart; si <= sEnd && !changed; si++) {
        const sp = loop[si]
        for (let j = 0; j < N; j++) {
          // Skip nearby indices (both directions around the loop)
          const fwd = (j - si + N) % N
          const bwd = (si - j + N) % N
          if (Math.min(fwd, bwd) < minSep)
            continue

          const dx = sp[0] - loop[j][0]
          const dy = sp[1] - loop[j][1]
          const dz = sp[2] - loop[j][2]
          if (dx * dx + dy * dy + dz * dz > thresholdSq)
            continue

          // loop[si] ≈ loop[j] — remove the shorter sub-loop between them
          const lo = Math.min(si, j)
          const hi = Math.max(si, j)
          const interiorLen = hi - lo - 1 // points between lo and hi
          const exteriorLen = N - interiorLen - 2 // points outside lo..hi

          if (interiorLen <= exteriorLen) {
            // Remove lo+1 .. hi (interior + one endpoint to merge)
            loop.splice(lo + 1, hi - lo)
          }
          else {
            // Keep lo .. hi
            const kept = loop.slice(lo, hi + 1)
            loop.length = 0
            loop.push(...kept)
          }
          changed = true
          break
        }
      }
    }
  }

  /**
   * Remove self-intersections from an open stroke (polyline).
   * Projects to a local best-fit 2D plane, detects crossings,
   * and keeps the longer sub-path at each crossing.
   */
  _cleanStrokeSelfIntersections(strokeVec3s) {
    if (strokeVec3s.length < 4)
      return strokeVec3s

    // Compute local best-fit plane for this stroke
    const centroid = new Vector3()
    for (const p of strokeVec3s) centroid.add(p)
    centroid.divideScalar(strokeVec3s.length)

    let xx = 0; let xy = 0; let xz = 0; let yy = 0; let yz = 0; let zz = 0
    for (const p of strokeVec3s) {
      const dx = p.x - centroid.x; const dy = p.y - centroid.y; const dz = p.z - centroid.z
      xx += dx * dx; xy += dx * dy; xz += dx * dz
      yy += dy * dy; yz += dy * dz; zz += dz * dz
    }
    const normal = this._smallestEigenvector([
      [xx, xy, xz],
      [xy, yy, yz],
      [xz, yz, zz],
    ])
    const tmp = Math.abs(normal.x) < 0.9 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
    const u = new Vector3().crossVectors(normal, tmp).normalize()
    const v = new Vector3().crossVectors(normal, u).normalize()

    // Project to 2D
    const pts2d = strokeVec3s.map(p => [
      (p.x - centroid.x) * u.x + (p.y - centroid.y) * u.y + (p.z - centroid.z) * u.z,
      (p.x - centroid.x) * v.x + (p.y - centroid.y) * v.y + (p.z - centroid.z) * v.z,
    ])

    // Find first self-intersection and resolve
    let result = [...strokeVec3s]
    let result2d = [...pts2d]
    let changed = true

    while (changed) {
      changed = false
      const N = result.length
      if (N < 4)
        break

      for (let i = 0; i < N - 1 && !changed; i++) {
        for (let j = i + 2; j < N - 1; j++) {
          if (this._segmentsIntersect2D(result2d[i], result2d[i + 1], result2d[j], result2d[j + 1])) {
            // Crossing between edge (i,i+1) and (j,j+1)
            // Two sub-paths: [0..i, j+1..N-1] (skip the loop) or [i+1..j] (the loop)
            // For an open polyline, keep the path that preserves start→end connectivity
            // Path A: 0→i then j+1→N-1 (removes the looping segment)
            // Path B: 0→j then i+1→N-1 — doesn't make sense for open polyline
            // Simply remove the shorter internal loop: indices i+1..j
            const pathA = [...result.slice(0, i + 1), ...result.slice(j + 1)]
            const pathA2d = [...result2d.slice(0, i + 1), ...result2d.slice(j + 1)]

            result = pathA
            result2d = pathA2d
            changed = true
            break
          }
        }
      }
    }

    return result
  }

  // ─── Line2 Update ─────────────────────────────────────

  _updateLineGeometry(loopIndex) {
    const line = this._lines[loopIndex]
    if (!line)
      return

    const pts = this._workingLoops[loopIndex].points
    const positions = []
    for (const p of pts) {
      positions.push(p[0], p[1], p[2])
    }
    positions.push(pts[0][0], pts[0][1], pts[0][2])

    line.geometry.dispose()
    const geometry = new LineGeometry()
    geometry.setPositions(positions)

    // Slight depth bias to avoid z-fighting with model surface
    line.material.polygonOffset = true
    line.material.polygonOffsetFactor = -7
    line.material.polygonOffsetUnits = -7
    line.geometry = geometry
    line.computeLineDistances()
  }

  // ─── Utilities ────────────────────────────────────────

  _dist3(a, b) {
    const ax = a.x !== undefined ? a.x : a[0]
    const ay = a.y !== undefined ? a.y : a[1]
    const az = a.z !== undefined ? a.z : a[2]
    const bx = b.x !== undefined ? b.x : b[0]
    const by = b.y !== undefined ? b.y : b[1]
    const bz = b.z !== undefined ? b.z : b[2]
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2)
  }

  _dist3Arr(a, b) {
    const ax = a.x !== undefined ? a.x : a[0]
    const ay = a.y !== undefined ? a.y : a[1]
    const az = a.z !== undefined ? a.z : a[2]
    return Math.sqrt((ax - b[0]) ** 2 + (ay - b[1]) ** 2 + (az - b[2]) ** 2)
  }
}
