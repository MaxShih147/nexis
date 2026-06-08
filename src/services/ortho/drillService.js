/**
 * Drain hole generation for ortho auto-processing.
 * Adapted from docs/autoProcessing_ortho_helper.js showDrainHoles() and showSideWallDrains().
 */
import { logger } from '@/utils/logger'
import { CylinderGeometry, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Vector2, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils'
import { pointInPolygon2D, polyArea2D, raySegIntersect2D } from './geoUtils'

/**
 * Generate drain hole cylinders at honeycomb wall edges.
 * @param {object} params
 * @param {number} params.radius - Hex cell radius (mm)
 * @param {number} params.wallThickness - Gap between cells (mm)
 * @param {number} params.gridCount - Number of cells per row
 * @param {number} params.drainRadius - Drain hole cylinder radius (mm)
 * @param {number} params.bottomZ - Z position of the print bed
 * @returns {Mesh|null} Drain hole mesh or null
 */
export function generateDrainHoles({
  radius = 5,
  wallThickness = 1,
  gridCount = 5,
  drainRadius = 1.5,
  bottomZ = 0,
}) {
  const spacing = radius + wallThickness / 2
  const colStep = spacing * Math.sqrt(3)
  const rowStep = spacing * 1.5
  const halfCols = (gridCount - 1) / 2
  const halfRows = (gridCount - 1) / 2

  const walls = []
  const edgeKey = (r1, c1, r2, c2) =>
    `${Math.min(r1 * 1000 + c1, r2 * 1000 + c2)}_${Math.max(r1 * 1000 + c1, r2 * 1000 + c2)}`
  const seen = new Set()

  function cellCenter(row, col) {
    const xOffset = (row % 2) * (colStep / 2)
    return {
      x: (col - halfCols) * colStep + xOffset,
      y: (row - halfRows) * rowStep,
    }
  }

  for (let row = 0; row < gridCount; row++) {
    for (let col = 0; col < gridCount; col++) {
      const neighbors = [
        [row, col + 1],
        [row + 1, (row % 2 === 0) ? col - 1 : col],
        [row + 1, (row % 2 === 0) ? col : col + 1],
      ]

      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= gridCount || nc < 0 || nc >= gridCount)
          continue
        const key = edgeKey(row, col, nr, nc)
        if (seen.has(key))
          continue
        seen.add(key)

        const a = cellCenter(row, col)
        const b = cellCenter(nr, nc)
        const midX = (a.x + b.x) / 2
        const midY = (a.y + b.y) / 2
        const dx = b.x - a.x
        const dy = b.y - a.y
        const angle = Math.atan2(dy, dx)
        walls.push({ midX, midY, angle })
      }
    }
  }

  if (walls.length === 0)
    return null

  const cylLength = wallThickness * 3
  const geometries = []

  for (const wall of walls) {
    const cylGeo = new CylinderGeometry(drainRadius, drainRadius, cylLength, 32)
    const q1 = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2)
    const q2 = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), wall.angle)
    q2.multiply(q1)
    const mat = new Matrix4()
    mat.makeRotationFromQuaternion(q2)
    mat.setPosition(wall.midX, wall.midY, bottomZ)
    cylGeo.applyMatrix4(mat)
    geometries.push(cylGeo)
  }

  const merged = mergeGeometries(geometries)
  for (const g of geometries) g.dispose()
  merged.computeVertexNormals()

  const material = new MeshStandardMaterial({
    color: 0xFFFF00,
    roughness: 0.4,
    metalness: 0.1,
  })

  const drainHoleMesh = new Mesh(merged, material)
  drainHoleMesh.name = 'drainHolesPreview'
  return drainHoleMesh
}

/**
 * Slice a mesh at a world-space Z plane, returning 2D polyline loops.
 * @param {Mesh} mesh - Three.js Mesh
 * @param {number} zWorld - Z plane in world coordinates
 * @param {number} eps - Endpoint merge tolerance (mm)
 * @returns {Vector2[][]} Array of closed loops
 */
function sliceMeshAtZ_World(mesh, zWorld, eps = 1e-3) {
  const geo = mesh.geometry
  const posAttr = geo.getAttribute('position')
  const index = geo.index
  const triCount = index ? index.count / 3 : posAttr.count / 3
  const matW = mesh.matrixWorld
  const segments = []

  const vA = new Vector3()
  const vB = new Vector3()
  const vC = new Vector3()

  for (let t = 0; t < triCount; t++) {
    const i0 = index ? index.getX(t * 3) : t * 3
    const i1 = index ? index.getX(t * 3 + 1) : t * 3 + 1
    const i2 = index ? index.getX(t * 3 + 2) : t * 3 + 2

    vA.fromBufferAttribute(posAttr, i0).applyMatrix4(matW)
    vB.fromBufferAttribute(posAttr, i1).applyMatrix4(matW)
    vC.fromBufferAttribute(posAttr, i2).applyMatrix4(matW)

    const pts = []
    const edges = [[vA, vB], [vB, vC], [vC, vA]]
    for (const [p0, p1] of edges) {
      const d0 = p0.z - zWorld
      const d1 = p1.z - zWorld
      if (d0 * d1 < 0) {
        const tParam = d0 / (d0 - d1)
        const x = p0.x + tParam * (p1.x - p0.x)
        const y = p0.y + tParam * (p1.y - p0.y)
        pts.push(new Vector2(x, y))
      }
    }
    if (pts.length === 2) {
      segments.push([pts[0], pts[1]])
    }
  }

  if (segments.length === 0)
    return []

  // Chain segments into closed loops using spatial hashing
  const epsKey = eps * 2
  const key = v => `${Math.round(v.x / epsKey)},${Math.round(v.y / epsKey)}`

  const adj = new Map()
  for (let si = 0; si < segments.length; si++) {
    for (let ei = 0; ei < 2; ei++) {
      const k = key(segments[si][ei])
      if (!adj.has(k))
        adj.set(k, [])
      adj.get(k).push({ si, ei })
    }
  }

  const used = new Uint8Array(segments.length)
  const loops = []

  for (let startSi = 0; startSi < segments.length; startSi++) {
    if (used[startSi])
      continue
    used[startSi] = 1
    const loop = [segments[startSi][0], segments[startSi][1]]
    let curKey = key(loop[loop.length - 1])
    const startKey = key(loop[0])

    for (let safety = 0; safety < segments.length; safety++) {
      const neighbors = adj.get(curKey)
      if (!neighbors)
        break
      let found = false
      for (const nb of neighbors) {
        if (used[nb.si])
          continue
        used[nb.si] = 1
        const otherEi = 1 - nb.ei
        loop.push(segments[nb.si][otherEi])
        curKey = key(segments[nb.si][otherEi])
        found = true
        break
      }
      if (!found)
        break
      if (curKey === startKey)
        break
    }
    if (loop.length >= 3)
      loops.push(loop)
  }

  return loops
}

/**
 * Generate side-wall drain cylinders using 2D cross-section approach.
 * @param {object} params
 * @param {Mesh} params.outerShell - The outer shell mesh (selected object)
 * @param {Mesh} params.innerShell - The inner shell mesh (hollow mesh)
 * @param {number} params.drainRadius - Cylinder radius (mm)
 * @param {number} params.hollowWallThickness - Shell thickness T (mm)
 * @param {number} params.bottomZ - Z position of the print bed
 * @param {number} params.hexCellRadius - Hex cell radius for wall-hit scoring
 * @param {number} params.hexWallThickness - Hex wall thickness for wall-hit scoring
 * @returns {Mesh|null} Side wall drain mesh or null
 */
export function generateSideWallDrains({
  outerShell,
  innerShell,
  drainRadius = 1.5,
  hollowWallThickness = 3.0,
  bottomZ = 0,
  hexCellRadius = 5,
  hexWallThickness = 1,
}) {
  if (!outerShell || !innerShell) {
    logger.warn('generateSideWallDrains: missing outer or inner shell')
    return null
  }

  const T = hollowWallThickness
  const maxHoles = 12
  const minSpacing = 6.0

  function nearestHexCenter2D(x, y) {
    const s = hexCellRadius + hexWallThickness / 2
    const cStep = s * Math.sqrt(3)
    const rStep = s * 1.5
    const r = Math.round(y / rStep)
    const x0 = x - ((r & 1) ? cStep * 0.5 : 0)
    const q = Math.round(x0 / cStep)
    return { cx: q * cStep + ((r & 1) ? cStep * 0.5 : 0), cy: r * rStep }
  }

  function wallHitScoreForHole(pOutX, pOutY, pInX, pInY, dirX, dirY, r) {
    const inset = 0.8
    const step = 0.4
    const perpX = -dirY
    const perpY = dirX
    const dx = pInX - pOutX
    const dy = pInY - pOutY
    const fullLen = Math.sqrt(dx * dx + dy * dy)
    if (fullLen < inset * 2 + step)
      return 0
    const startT = inset / fullLen
    const endT = 1 - inset / fullLen
    let hits = 0
    for (let frac = startT; frac <= endT + 1e-9; frac += step / fullLen) {
      const sx = pOutX + dx * frac
      const sy = pOutY + dy * frac
      const offsets = [0, 0.8 * r, -0.8 * r]
      for (const off of offsets) {
        const tx = sx + perpX * off
        const ty = sy + perpY * off
        const hc = nearestHexCenter2D(tx, ty)
        const ddx = tx - hc.cx
        const ddy = ty - hc.cy
        if (Math.sqrt(ddx * ddx + ddy * ddy) >= hexCellRadius)
          hits++
      }
    }
    return hits
  }

  const z_drain = bottomZ

  // Slice both meshes
  outerShell.updateMatrixWorld(true)
  innerShell.updateMatrixWorld(true)

  const innerLoops = sliceMeshAtZ_World(innerShell, z_drain)

  const outerSliceLift = 1.0
  let z_outer_slice = z_drain + outerSliceLift
  let outerLoops = sliceMeshAtZ_World(outerShell, z_outer_slice)
  if (outerLoops.length === 0) {
    z_outer_slice = z_drain + 0.5
    outerLoops = sliceMeshAtZ_World(outerShell, z_outer_slice)
  }
  if (outerLoops.length === 0) {
    z_outer_slice = z_drain + 2.0
    outerLoops = sliceMeshAtZ_World(outerShell, z_outer_slice)
  }

  if (outerLoops.length === 0 || innerLoops.length === 0) {
    logger.warn(`[SideWallDrains] No valid cross-section. outerLoops=${outerLoops.length}, innerLoops=${innerLoops.length}`)
    return null
  }

  // Pick the largest loop by absolute area
  let outerPoly = outerLoops[0]
  let outerArea = 0
  for (const loop of outerLoops) {
    const a = Math.abs(polyArea2D(loop))
    if (a > outerArea) {
      outerArea = a
      outerPoly = loop
    }
  }
  let innerPoly = innerLoops[0]
  let innerArea = 0
  for (const loop of innerLoops) {
    const a = Math.abs(polyArea2D(loop))
    if (a > innerArea) {
      innerArea = a
      innerPoly = loop
    }
  }

  // Resample outerPoly at uniform arc length
  const N_SAMPLES = 360
  const totalLen = (() => {
    let len = 0
    for (let i = 0; i < outerPoly.length; i++) {
      const j = (i + 1) % outerPoly.length
      len += outerPoly[i].distanceTo(outerPoly[j])
    }
    return len
  })()

  const samples = []
  let accumulated = 0
  let segIdx = 0
  const segStep = totalLen / N_SAMPLES
  let segStart = outerPoly[0]
  let segEnd = outerPoly[1 % outerPoly.length]
  let segLen = segStart.distanceTo(segEnd)
  let segAcc = 0

  for (let s = 0; s < N_SAMPLES; s++) {
    const targetDist = s * segStep
    while (accumulated + segLen - segAcc < targetDist && segIdx < outerPoly.length - 1) {
      accumulated += segLen - segAcc
      segAcc = 0
      segIdx++
      segStart = outerPoly[segIdx % outerPoly.length]
      segEnd = outerPoly[(segIdx + 1) % outerPoly.length]
      segLen = segStart.distanceTo(segEnd)
    }
    const rem = targetDist - accumulated
    const frac = segLen > 1e-9 ? (segAcc + rem) / segLen : 0
    const p = new Vector2().lerpVectors(segStart, segEnd, Math.min(frac, 1))
    samples.push({ p, segIdx: segIdx % outerPoly.length })
  }

  // Compute centroid of outerPoly
  const C = new Vector2(0, 0)
  for (const v of outerPoly) {
    C.x += v.x
    C.y += v.y
  }
  C.x /= outerPoly.length
  C.y /= outerPoly.length

  // Assign samples to angular bins
  const bins = Array.from({ length: maxHoles }).fill(null)
  for (let si = 0; si < samples.length; si++) {
    const s = samples[si]
    const angle = Math.atan2(s.p.y - C.y, s.p.x - C.x)
    const binIdx = Math.floor(((angle + Math.PI) / (2 * Math.PI)) * maxHoles) % maxHoles
    if (!bins[binIdx]) {
      bins[binIdx] = { p: s.p, angle, segIdx: s.segIdx, sampleIdx: si }
    }
  }

  // Evaluate a sample index for side-wall drain placement
  const N = samples.length
  const pLen = outerPoly.length
  const sampleSpacing = totalLen / N
  const deltaIdxPerStep = Math.max(1, Math.round(0.3 / sampleSpacing))

  function evaluateSampleIdx(idx) {
    const samp = samples[idx]
    const segI = samp.segIdx
    const pPrev = outerPoly[(segI - 1 + pLen) % pLen]
    const pNext = outerPoly[(segI + 2) % pLen]
    const tx = pNext.x - pPrev.x
    const ty = pNext.y - pPrev.y
    const tLen2 = Math.sqrt(tx * tx + ty * ty)
    if (tLen2 < 1e-9)
      return null
    let nx = -ty / tLen2
    let ny = tx / tLen2
    if (!pointInPolygon2D(outerPoly, samp.p.x + nx * 0.1, samp.p.y + ny * 0.1)) {
      nx = -nx
      ny = -ny
    }
    let bestT = Infinity
    for (let i = 0; i < innerPoly.length; i++) {
      const j = (i + 1) % innerPoly.length
      const t = raySegIntersect2D(samp.p.x, samp.p.y, nx, ny, innerPoly[i].x, innerPoly[i].y, innerPoly[j].x, innerPoly[j].y)
      if (t !== null && t > 0.01 && t < bestT)
        bestT = t
    }
    if (bestT === Infinity)
      return null
    if (bestT < 0.6 * T || bestT > 3.0 * T)
      return null
    const piX = samp.p.x + nx * bestT
    const piY = samp.p.y + ny * bestT
    const score = wallHitScoreForHole(samp.p.x, samp.p.y, piX, piY, nx, ny, drainRadius)
    return { pOutX: samp.p.x, pOutY: samp.p.y, pInX: piX, pInY: piY, dir2x: nx, dir2y: ny, D2: bestT, score }
  }

  const geometries = []
  const skipReasons = { noBin: 0, noInnerHit: 0, tooClose: 0 }
  const placed = []

  for (let b = 0; b < maxHoles; b++) {
    const cand = bins[b]
    if (!cand) {
      skipReasons.noBin++
      continue
    }

    const origResult = evaluateSampleIdx(cand.sampleIdx)
    if (!origResult) {
      skipReasons.noInnerHit++
      continue
    }

    // Slide search
    let best = origResult
    let bestAbsStep = 0
    for (let step = 1; step <= 5; step++) {
      for (const sign of [1, -1]) {
        const tryIdx = ((cand.sampleIdx + sign * step * deltaIdxPerStep) % N + N) % N
        const res = evaluateSampleIdx(tryIdx)
        if (!res)
          continue
        if (res.score < best.score || (res.score === best.score && step < bestAbsStep)) {
          best = res
          bestAbsStep = step
        }
      }
    }

    const { pOutX, pOutY, pInX, pInY, dir2x, dir2y, D2 } = best
    const cx = (pOutX + pInX) / 2
    const cy = (pOutY + pInY) / 2

    // Spacing check
    let tooClose = false
    for (const prev of placed) {
      const ddx = cx - prev.center.x
      const ddy = cy - prev.center.y
      if (Math.sqrt(ddx * ddx + ddy * ddy) < minSpacing) {
        tooClose = true
        break
      }
    }
    if (tooClose) {
      skipReasons.tooClose++
      continue
    }

    // Build 3D cylinder
    const L = D2 + 0.3 + 0.4
    const cylGeo = new CylinderGeometry(drainRadius, drainRadius, L, 32)
    const q1 = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -Math.PI / 2)
    const q2 = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.atan2(dir2y, dir2x))
    q2.multiply(q1)
    const mat = new Matrix4()
    mat.makeRotationFromQuaternion(q2)
    mat.setPosition(cx, cy, z_drain)
    cylGeo.applyMatrix4(mat)
    geometries.push(cylGeo)
    placed.push({ center: new Vector2(cx, cy) })
  }

  if (geometries.length === 0) {
    logger.warn('[SideWallDrains] No cylinders generated')
    return null
  }

  const merged = mergeGeometries(geometries)
  for (const g of geometries) g.dispose()
  merged.computeVertexNormals()

  const material = new MeshStandardMaterial({
    color: 0x2196F3,
    roughness: 0.3,
    metalness: 0.1,
  })

  const sideWallDrainMesh = new Mesh(merged, material)
  sideWallDrainMesh.name = 'sideWallDrainsPreview'
  return sideWallDrainMesh
}
