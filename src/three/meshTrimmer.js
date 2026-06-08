import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three'

/* eslint-disable style/max-statements-per-line, no-console, unicorn/no-new-array, no-unused-vars, unused-imports/no-unused-vars */

/**
 * Auto-orient model so the boundary opening faces -Z (downward).
 * Rotates geometry in local space and shifts the object transform so the bottom sits on world Z=0.
 * Returns the world-space matrix applied to boundary points.
 *
 * @param {Object3D} model - The mesh object to orient
 * @param {Array} boundaryWorldPoints - Main boundary loop points [[x,y,z], ...]
 * @returns {{ rotated: boolean, boundaryTransformMatrix: Matrix4 }} Orientation result and boundary transform.
 */
export function autoOrientModel(model, boundaryWorldPoints) {
  const geometry = model.geometry
  model.updateMatrixWorld(true)
  const matrixWorld = model.matrixWorld.clone()
  const invMatrix = matrixWorld.clone().invert()
  const localBoundary = boundaryWorldPoints.map(p =>
    new Vector3(p[0], p[1], p[2]).applyMatrix4(invMatrix),
  )

  // PCA: compute boundary plane normal (eigenvector with smallest eigenvalue)
  const centroid = new Vector3()
  for (const p of localBoundary) centroid.add(p)
  centroid.divideScalar(localBoundary.length)

  // Covariance matrix (3×3 symmetric)
  let xx = 0
  let xy = 0
  let xz = 0
  let yy = 0
  let yz = 0
  let zz = 0
  for (const p of localBoundary) {
    const dx = p.x - centroid.x
    const dy = p.y - centroid.y
    const dz = p.z - centroid.z
    xx += dx * dx
    xy += dx * dy
    xz += dx * dz
    yy += dy * dy
    yz += dy * dz
    zz += dz * dz
  }

  // Find smallest eigenvector of 3×3 symmetric matrix via analytical method
  const normal = smallestEigenvector3x3(xx, xy, xz, yy, yz, zz)

  // Normal should point outward (away from mesh body)
  const posAttr = geometry.getAttribute('position')
  const meshCentroid = new Vector3()
  for (let i = 0; i < posAttr.count; i++) {
    meshCentroid.x += posAttr.getX(i)
    meshCentroid.y += posAttr.getY(i)
    meshCentroid.z += posAttr.getZ(i)
  }
  meshCentroid.divideScalar(posAttr.count)

  const toMesh = new Vector3().subVectors(meshCentroid, centroid)
  if (normal.dot(toMesh) > 0)
    normal.negate()

  // Target: opening faces world -Z, expressed in the model's current local basis.
  const target = new Vector3(0, 0, -1).transformDirection(invMatrix)
  const dot = normal.dot(target)

  if (dot > 0.9999) {
    return { rotated: false, boundaryTransformMatrix: new Matrix4() }
  }

  // Compute rotation quaternion
  const quat = new Quaternion()
  if (dot < -0.9999) {
    // Exactly opposite — rotate 180° around X
    quat.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI)
  }
  else {
    const axis = new Vector3().crossVectors(normal, target).normalize()
    const angle = Math.acos(Math.max(-1, Math.min(1, dot)))
    quat.setFromAxisAngle(axis, angle)
  }

  // Build rotation matrix around mesh centroid
  const rotMatrix = new Matrix4()
  const toOrigin = new Matrix4().makeTranslation(-meshCentroid.x, -meshCentroid.y, -meshCentroid.z)
  const rot = new Matrix4().makeRotationFromQuaternion(quat)
  const fromOrigin = new Matrix4().makeTranslation(meshCentroid.x, meshCentroid.y, meshCentroid.z)
  rotMatrix.multiplyMatrices(fromOrigin, rot.multiply(toOrigin))

  // Apply to geometry vertices
  geometry.applyMatrix4(rotMatrix)

  const boundaryTransformMatrix = new Matrix4().multiplyMatrices(
    matrixWorld,
    new Matrix4().multiplyMatrices(rotMatrix, invMatrix),
  )

  const minWorldZ = getMinWorldZ(geometry, matrixWorld)
  if (Math.abs(minWorldZ) > 0.001) {
    const worldShift = new Vector3(0, 0, -minWorldZ)
    translateObjectInWorld(model, worldShift)
    boundaryTransformMatrix.premultiply(new Matrix4().makeTranslation(worldShift.x, worldShift.y, worldShift.z))
  }

  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  if (typeof geometry.computeBoundsTree === 'function')
    geometry.computeBoundsTree()

  return { rotated: true, boundaryTransformMatrix }
}

/**
 * Transform boundary loop points by a matrix.
 * @param {Array} loops - Array of { points: [[x,y,z], ...], ... }
 * @param {Matrix4} matrix - Transformation matrix in world space
 * @returns {Array} New loops with transformed points
 */
export function transformLoopPoints(loops, matrix) {
  const v = new Vector3()
  return loops.map(loop => ({
    ...loop,
    points: loop.points.map((p) => {
      v.set(p[0], p[1], p[2]).applyMatrix4(matrix)
      return [v.x, v.y, v.z]
    }),
  }))
}

function getMinWorldZ(geometry, matrixWorld) {
  const posAttr = geometry.getAttribute('position')
  const vertex = new Vector3()
  let minZ = Infinity
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i).applyMatrix4(matrixWorld)
    if (vertex.z < minZ)
      minZ = vertex.z
  }
  return minZ
}

function translateObjectInWorld(object, worldShift) {
  if (object.parent) {
    object.parent.updateMatrixWorld(true)
    const parentInv = object.parent.matrixWorld.clone().invert()
    const worldStart = new Vector3().setFromMatrixPosition(object.matrixWorld)
    const localStart = worldStart.clone().applyMatrix4(parentInv)
    const localEnd = worldStart.clone().add(worldShift).applyMatrix4(parentInv)
    object.position.add(localEnd.sub(localStart))
  }
  else {
    object.position.add(worldShift)
  }
  object.updateMatrixWorld(true)
}

/**
 * Smallest eigenvector of a 3×3 symmetric matrix via characteristic equation.
 * Uses the iterative power method on the inverse-shifted matrix.
 */
function smallestEigenvector3x3(xx, xy, xz, yy, yz, zz) {
  // Use inverse iteration: find eigenvector for smallest eigenvalue
  // First estimate eigenvalues via Gershgorin or just use power iteration on (A - σI)^(-1)
  // Simpler: use cross-product method on covariance rows
  // The normal to the plane = smallest eigenvector ≈ cross product of two largest spread directions

  // Actually, use the analytical approach: compute eigenvalues of 3x3 symmetric
  const a = xx; const b = yy; const c = zz; const d = xy; const e = xz; const f = yz

  // Characteristic polynomial: λ³ - tr·λ² + (minors)·λ - det = 0
  const tr = a + b + c
  const q = tr / 3
  const p1 = d * d + e * e + f * f
  const p2 = (a - q) * (a - q) + (b - q) * (b - q) + (c - q) * (c - q) + 2 * p1
  const p = Math.sqrt(p2 / 6)

  if (p < 1e-14) {
    // All eigenvalues equal — any vector works, pick Z
    return new Vector3(0, 0, 1)
  }

  // B = (1/p) * (A - qI)
  const invP = 1 / p
  const b00 = (a - q) * invP; const b01 = d * invP; const b02 = e * invP
  const b11 = (b - q) * invP; const b12 = f * invP
  const b22 = (c - q) * invP

  const detB = b00 * (b11 * b22 - b12 * b12)
    - b01 * (b01 * b22 - b12 * b02)
    + b02 * (b01 * b12 - b11 * b02)
  const halfDetB = detB / 2

  // phi ∈ [0, π/3]
  let phi
  if (halfDetB <= -1)
    phi = Math.PI / 3
  else if (halfDetB >= 1)
    phi = 0
  else phi = Math.acos(halfDetB) / 3

  // Eigenvalues (sorted: e0 ≤ e1 ≤ e2)
  const e0 = q + 2 * p * Math.cos(phi + (2 * Math.PI / 3)) // smallest
  // const e1 = q + 2 * p * Math.cos(phi)                   // not needed
  // const e2 = 3 * q - e0 - e1                              // not needed

  // Find eigenvector for e0: (A - e0*I) * v = 0
  // Use two rows, cross product gives the null-space vector
  const r00 = xx - e0; const r01 = xy; const r02 = xz
  const r10 = xy; const r11 = yy - e0; const r12 = yz

  const v = new Vector3(
    r01 * r12 - r02 * r11,
    r02 * r10 - r00 * r12,
    r00 * r11 - r01 * r10,
  )

  const len = v.length()
  if (len < 1e-14) {
    // Degenerate — try other row pair
    const r20 = xz; const r21 = yz; const r22 = zz - e0
    v.set(
      r11 * r22 - r12 * r21,
      r12 * r20 - r10 * r22,
      r10 * r21 - r11 * r20,
    )
    const len2 = v.length()
    if (len2 < 1e-14)
      return new Vector3(0, 0, 1)
    v.divideScalar(len2)
  }
  else {
    v.divideScalar(len)
  }

  return v
}

/**
 * Trim mesh along boundary using Resample → Project → Walk → Split algorithm.
 *
 * Key innovation: shared edgeCrossingMap ensures topological consistency —
 * when the cutting path crosses a shared edge, both adjacent faces use the
 * exact same crossing point, preventing junction vertices (degree 4/6/8).
 *
 * Phase 0: Setup (coordinate transform, BVH, edge-to-faces map)
 * Phase 1: Resample affected boundary segments (dense sampling)
 * Phase 2: Project onto mesh surface via BVH
 * Phase 3: Walk across surface + record crossings (shared edgeCrossingMap)
 * Phase 4: Split cut faces using shared crossing points
 * Phase 5: Flood fill → keep largest component + C1 buffer
 * Phase 6: T-junction repair + assemble
 */
export function trimMeshAlongBoundary(geometry, boundaryWorldPoints, matrixWorld, options = {}) {
  const { preBrushBoundary = null } = options

  // ── Phase 0: Setup ──
  const invMatrix = matrixWorld.clone().invert()
  const boundary3D = boundaryWorldPoints.map(p =>
    new Vector3(p[0], p[1], p[2]).applyMatrix4(invMatrix),
  )
  const bLen = boundary3D.length

  // Determine affected boundary segments
  const affectedIndices = []
  if (preBrushBoundary) {
    const preBrush3D = preBrushBoundary.map(p =>
      new Vector3(p[0], p[1], p[2]).applyMatrix4(invMatrix),
    )
    const { mask, maxMovement, movedCount } = computeSegmentAffected(boundary3D, preBrush3D, bLen)
    for (let i = 0; i < bLen; i++) {
      if (mask[i])
        affectedIndices.push(i)
    }
    console.log('[trimmer-v2] moved:', movedCount, 'maxMove:', maxMovement.toFixed(3), 'affSegs:', affectedIndices.length)
  }
  else {
    for (let i = 0; i < bLen; i++) affectedIndices.push(i)
  }

  if (affectedIndices.length === 0) {
    console.warn('[trimmer-v2] no affected segments')
    return geometry.clone()
  }

  // Ensure BVH exists
  if (!geometry.boundsTree && typeof geometry.computeBoundsTree === 'function') {
    geometry.computeBoundsTree()
  }
  const bvh = geometry.boundsTree
  if (!bvh) {
    console.warn('[trimmer-v2] no BVH available, falling back to clone')
    return geometry.clone()
  }

  // Read mesh
  const posAttr = geometry.getAttribute('position')
  const gIdx = geometry.getIndex()
  const vertexCount = posAttr.count
  const faceCount = gIdx ? gIdx.count / 3 : vertexCount / 3

  const positions = new Array(vertexCount)
  for (let i = 0; i < vertexCount; i++) {
    positions[i] = new Vector3(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
  }

  function faceVerts(f) {
    if (gIdx)
      return [gIdx.getX(f * 3), gIdx.getX(f * 3 + 1), gIdx.getX(f * 3 + 2)]
    return [f * 3, f * 3 + 1, f * 3 + 2]
  }

  // Canonical vertex mapping
  const PREC = 10000
  const posMap = new Map()
  const canon = new Int32Array(vertexCount)
  let nextC = 0
  for (let i = 0; i < vertexCount; i++) {
    const p = positions[i]
    const key = `${Math.round(p.x * PREC)},${Math.round(p.y * PREC)},${Math.round(p.z * PREC)}`
    let c = posMap.get(key)
    if (c === undefined) { c = nextC++; posMap.set(key, c) }
    canon[i] = c
  }

  // Build edge-to-faces adjacency map
  const edgeToFaces = new Map()
  for (let f = 0; f < faceCount; f++) {
    const [i0, i1, i2] = faceVerts(f)
    const c0 = canon[i0]; const c1 = canon[i1]; const c2 = canon[i2]
    for (const [a, b] of [[c0, c1], [c1, c2], [c2, c0]]) {
      const ek = a < b ? `${a},${b}` : `${b},${a}`
      let list = edgeToFaces.get(ek)
      if (!list) { list = []; edgeToFaces.set(ek, list) }
      list.push(f)
    }
  }

  // ── Phase 1: Resample ──
  const avgEdgeLen = computeAverageEdgeLength(positions, faceCount, faceVerts, 2000)
  const resampleStep = avgEdgeLen * 0.3
  const resampledPts = resampleBoundarySegments(boundary3D, affectedIndices, resampleStep)
  console.log('[trimmer-v2] avgEdgeLen:', avgEdgeLen.toFixed(4), 'resampleStep:', resampleStep.toFixed(4), 'resampledPts:', resampledPts.length)

  // ── Phase 2: Project onto mesh surface ──
  const MAX_PROJ_DIST = 2.0
  const projectedPts = projectOntoMesh(resampledPts, bvh, MAX_PROJ_DIST)
  console.log('[trimmer-v2] projected:', projectedPts.length, '/', resampledPts.length)

  if (projectedPts.length < 2) {
    console.warn('[trimmer-v2] insufficient projected points')
    return geometry.clone()
  }

  // ── Phase 3: Walk + Record Crossings ──
  const edgeCrossingMap = new Map() // canonical edge key → Vector3
  const cutFaces = new Set() // faces the cutting path passes through

  const VERTEX_SNAP_EPS = 1e-4

  for (let pi = 0; pi < projectedPts.length - 1; pi++) {
    const ptA = projectedPts[pi]
    const ptB = projectedPts[pi + 1]

    if (ptA.faceIndex === ptB.faceIndex) {
      // Same face — mark as cut but no edge crossing
      cutFaces.add(ptA.faceIndex)
      continue
    }

    // Walk from ptA.faceIndex to ptB.faceIndex
    let currentFace = ptA.faceIndex
    let currentPos = ptA.pos.clone()
    const targetPos = ptB.pos
    let iter = 0
    const MAX_WALK = 100

    while (currentFace !== ptB.faceIndex && iter++ < MAX_WALK) {
      cutFaces.add(currentFace)

      const [i0, i1, i2] = faceVerts(currentFace)
      const c0 = canon[i0]; const c1 = canon[i1]; const c2 = canon[i2]
      const v0 = positions[i0]; const v1 = positions[i1]; const v2 = positions[i2]
      const cIds = [c0, c1, c2]
      const verts = [v0, v1, v2]

      // Build local 2D frame for this face (once, outside edge loop)
      const faceE1 = new Vector3().subVectors(v1, v0)
      const faceE2 = new Vector3().subVectors(v2, v0)
      const faceN = new Vector3().crossVectors(faceE1, faceE2)
      const fnLenSq = faceN.lengthSq()

      let exitEdgeIdx = -1
      let exitPt = null

      if (fnLenSq < 1e-14)
        break // degenerate face

      faceN.divideScalar(Math.sqrt(fnLenSq))
      const uAx = faceE1.clone().normalize()
      const vAx = new Vector3().crossVectors(faceN, uAx)

      // Project currentPos and targetPos to 2D
      const cpDx = currentPos.x - v0.x; const cpDy = currentPos.y - v0.y; const cpDz = currentPos.z - v0.z
      const tpDx = targetPos.x - v0.x; const tpDy = targetPos.y - v0.y; const tpDz = targetPos.z - v0.z
      const c2d = [cpDx * uAx.x + cpDy * uAx.y + cpDz * uAx.z, cpDx * vAx.x + cpDy * vAx.y + cpDz * vAx.z]
      const t2d = [tpDx * uAx.x + tpDy * uAx.y + tpDz * uAx.z, tpDx * vAx.x + tpDy * vAx.y + tpDz * vAx.z]

      // Find which edge the line currentPos→targetPos exits through
      let bestT = Infinity
      for (let ei = 0; ei < 3; ei++) {
        const va = verts[ei]; const vb = verts[(ei + 1) % 3]
        // Project edge endpoints to 2D
        const adx = va.x - v0.x; const ady = va.y - v0.y; const adz = va.z - v0.z
        const bdx = vb.x - v0.x; const bdy = vb.y - v0.y; const bdz = vb.z - v0.z
        const a2 = [adx * uAx.x + ady * uAx.y + adz * uAx.z, adx * vAx.x + ady * vAx.y + adz * vAx.z]
        const b2 = [bdx * uAx.x + bdy * uAx.y + bdz * uAx.z, bdx * vAx.x + bdy * vAx.y + bdz * vAx.z]

        const result = segmentIntersect2DParam(c2d, t2d, a2, b2)
        if (result !== null && result.t > -1e-6 && result.t < bestT) {
          bestT = result.t
          exitEdgeIdx = ei

          // Snap u to vertex if very close
          let u = result.u
          if (u < VERTEX_SNAP_EPS)
            u = 0
          else if (u > 1 - VERTEX_SNAP_EPS)
            u = 1

          exitPt = new Vector3().lerpVectors(va, vb, u)
        }
      }

      if (exitEdgeIdx < 0) {
        // No exit found — try to skip to next projected point
        break
      }

      // Record edge crossing with shared map
      const ca = cIds[exitEdgeIdx]; const cb = cIds[(exitEdgeIdx + 1) % 3]
      const ek = ca < cb ? `${ca},${cb}` : `${cb},${ca}`

      if (edgeCrossingMap.has(ek)) {
        exitPt = edgeCrossingMap.get(ek) // Reuse existing crossing point!
      }
      else {
        edgeCrossingMap.set(ek, exitPt)
      }

      // Move to the face on the other side of this edge
      const adjFaces = edgeToFaces.get(ek)
      if (!adjFaces || adjFaces.length < 2) {
        // Free edge (mesh boundary) — stop walk
        break
      }
      const nextFace = adjFaces[0] === currentFace ? adjFaces[1] : adjFaces[0]
      currentPos = exitPt
      currentFace = nextFace
    }

    cutFaces.add(currentFace) // mark the final face too
  }

  console.log('[trimmer-v2] cutFaces:', cutFaces.size, 'edgeCrossings:', edgeCrossingMap.size)

  if (cutFaces.size === 0) {
    console.warn('[trimmer-v2] no faces cut')
    return geometry.clone()
  }

  // ── Phase 4 + 5: Flood fill to find keep/delete components ──
  // Mark cut faces (analogous to old "isT")
  const isCut = new Uint8Array(faceCount)
  for (const f of cutFaces) isCut[f] = 1

  // Collect cut vertices for dilation
  const cutVerts = new Set()
  for (const f of cutFaces) {
    const [i0, i1, i2] = faceVerts(f)
    cutVerts.add(canon[i0]); cutVerts.add(canon[i1]); cutVerts.add(canon[i2])
  }

  // Dilate — non-cut faces with ≥2 cut vertices → buffer
  const isDilated = new Uint8Array(faceCount)
  let dilatedCount = 0
  for (let f = 0; f < faceCount; f++) {
    if (isCut[f])
      continue
    const [i0, i1, i2] = faceVerts(f)
    const cnt = (cutVerts.has(canon[i0]) ? 1 : 0)
      + (cutVerts.has(canon[i1]) ? 1 : 0)
      + (cutVerts.has(canon[i2]) ? 1 : 0)
    if (cnt >= 2) { isDilated[f] = 1; dilatedCount++ }
  }
  if (dilatedCount)
    console.log('[trimmer-v2] dilated:', dilatedCount)

  // Build adjacency excluding cut + dilated faces
  const floodEdgeMap = new Map()
  for (let f = 0; f < faceCount; f++) {
    if (isCut[f] || isDilated[f])
      continue
    const [i0, i1, i2] = faceVerts(f)
    const c0 = canon[i0]; const c1 = canon[i1]; const c2 = canon[i2]
    for (const [a, b] of [[c0, c1], [c1, c2], [c2, c0]]) {
      if (cutVerts.has(a) && cutVerts.has(b))
        continue
      const ek = a < b ? `${a},${b}` : `${b},${a}`
      let list = floodEdgeMap.get(ek)
      if (!list) { list = []; floodEdgeMap.set(ek, list) }
      list.push(f)
    }
  }

  // Flood fill
  const compId = new Int32Array(faceCount).fill(-1)
  const compSizes = []
  let numComp = 0
  for (let f = 0; f < faceCount; f++) {
    if (isCut[f] || isDilated[f] || compId[f] >= 0)
      continue
    const id = numComp++
    let size = 0
    const queue = [f]
    compId[f] = id
    while (queue.length > 0) {
      const cur = queue.pop()
      size++
      const [ci0, ci1, ci2] = faceVerts(cur)
      const cc0 = canon[ci0]; const cc1 = canon[ci1]; const cc2 = canon[ci2]
      for (const [ca, cb] of [[cc0, cc1], [cc1, cc2], [cc2, cc0]]) {
        const ek = ca < cb ? `${ca},${cb}` : `${cb},${ca}`
        const faces = floodEdgeMap.get(ek)
        if (!faces)
          continue
        for (const nb of faces) {
          if (compId[nb] >= 0)
            continue
          compId[nb] = id
          queue.push(nb)
        }
      }
    }
    compSizes.push(size)
  }

  // Keep largest component
  let keepComp = 0
  for (let i = 1; i < numComp; i++) {
    if (compSizes[i] > compSizes[keepComp])
      keepComp = i
  }
  console.log('[trimmer-v2] components:', numComp, 'sizes:', compSizes.join(','), 'keep:', keepComp)

  // Classify dilated as C1 (keep-side) or C2 (delete-side)
  const keepCompVerts = new Set()
  for (let f = 0; f < faceCount; f++) {
    if (compId[f] !== keepComp)
      continue
    const [i0, i1, i2] = faceVerts(f)
    keepCompVerts.add(canon[i0]); keepCompVerts.add(canon[i1]); keepCompVerts.add(canon[i2])
  }

  const isC1 = new Uint8Array(faceCount)
  let c1Count = 0; let c2Count = 0
  for (let f = 0; f < faceCount; f++) {
    if (!isDilated[f])
      continue
    const [i0, i1, i2] = faceVerts(f)
    if (keepCompVerts.has(canon[i0]) || keepCompVerts.has(canon[i1]) || keepCompVerts.has(canon[i2])) {
      isC1[f] = 1; c1Count++
    }
    else {
      c2Count++
    }
  }
  console.log('[trimmer-v2] C1 (keep):', c1Count, 'C2 (delete):', c2Count)

  // Build delete-side vertex set
  const deleteCompVerts = new Set()
  for (let f = 0; f < faceCount; f++) {
    if (compId[f] >= 0 && compId[f] !== keepComp) {
      const [i0, i1, i2] = faceVerts(f)
      deleteCompVerts.add(canon[i0]); deleteCompVerts.add(canon[i1]); deleteCompVerts.add(canon[i2])
    }
    if (isDilated[f] && !isC1[f]) {
      const [i0, i1, i2] = faceVerts(f)
      deleteCompVerts.add(canon[i0]); deleteCompVerts.add(canon[i1]); deleteCompVerts.add(canon[i2])
    }
  }

  // Add C1 vertices to keep set for cut-face vertex classification
  for (let f = 0; f < faceCount; f++) {
    if (!isC1[f])
      continue
    const [i0, i1, i2] = faceVerts(f)
    keepCompVerts.add(canon[i0]); keepCompVerts.add(canon[i1]); keepCompVerts.add(canon[i2])
  }

  function isVertexKeep(cid) {
    const inKeep = keepCompVerts.has(cid)
    const inDel = deleteCompVerts.has(cid)
    if (inKeep && !inDel)
      return true
    if (inDel && !inKeep)
      return false
    return true // ambiguous → keep (safe default)
  }

  // ── Phase 4: Split cut faces ──
  const keptTriangles = []
  let tKept = 0; let tSplit = 0; let tDiscard = 0

  for (const f of cutFaces) {
    const [i0, i1, i2] = faceVerts(f)
    const verts = [positions[i0], positions[i1], positions[i2]]
    const cIds = [canon[i0], canon[i1], canon[i2]]
    const isKeep = [isVertexKeep(cIds[0]), isVertexKeep(cIds[1]), isVertexKeep(cIds[2])]
    const keepCount = isKeep.filter(Boolean).length

    if (keepCount === 3) {
      keptTriangles.push(verts); tKept++; continue
    }
    if (keepCount === 0) {
      tDiscard++; continue
    }

    // Find edge crossings on this face from edgeCrossingMap
    const crossings = new Map() // edgeIdx → { point3D }
    for (let ei = 0; ei < 3; ei++) {
      const ca = cIds[ei]; const cb = cIds[(ei + 1) % 3]
      const ek = ca < cb ? `${ca},${cb}` : `${cb},${ca}`
      const cp = edgeCrossingMap.get(ek)
      if (cp)
        crossings.set(ei, { point3D: cp })
    }

    if (crossings.size === 2) {
      const splitTris = splitCutFace(verts, isKeep, crossings)
      if (splitTris) {
        for (const tri of splitTris) keptTriangles.push(tri)
        tSplit++; continue
      }
    }

    // Fallback: keep if majority on keep side
    if (keepCount >= 2) { keptTriangles.push(verts); tKept++ }
    else {
      tDiscard++
    }
  }
  console.log('[trimmer-v2] cut: kept:', tKept, 'split:', tSplit, 'discard:', tDiscard)

  // ── Phase 6: Assemble — M + C1 (split at T-junction crossing points) ──
  let mCount = 0; let tjSplit = 0
  for (let f = 0; f < faceCount; f++) {
    if (compId[f] !== keepComp && !isC1[f])
      continue
    const [i0, i1, i2] = faceVerts(f)
    const verts = [positions[i0], positions[i1], positions[i2]]
    const cIds = [canon[i0], canon[i1], canon[i2]]

    // Check if any edge has a crossing point from the walk
    const splits = []
    for (let ei = 0; ei < 3; ei++) {
      const ca = cIds[ei]; const cb = cIds[(ei + 1) % 3]
      const ek = ca < cb ? `${ca},${cb}` : `${cb},${ca}`
      const cp = edgeCrossingMap.get(ek)
      if (cp)
        splits.push({ ei, cp })
    }

    if (splits.length === 0) {
      keptTriangles.push(verts)
    }
    else if (splits.length === 1) {
      const { ei, cp } = splits[0]
      const vi = ei; const vj = (ei + 1) % 3; const vk = (ei + 2) % 3
      keptTriangles.push([verts[vi], cp, verts[vk]])
      keptTriangles.push([cp, verts[vj], verts[vk]])
      tjSplit++
    }
    else {
      splits.sort((a, b) => a.ei - b.ei)
      if (splits.length === 2) {
        const [s0, s1] = splits
        const shared = (s0.ei + 1) % 3 === s1.ei
          ? s0.ei
          : (s1.ei + 1) % 3 === s0.ei
              ? s1.ei
              : -1
        if (shared >= 0) {
          const vA = shared; const vB = (shared + 1) % 3; const vC = (shared + 2) % 3
          const cpA = s0.ei === shared ? s0.cp : s1.cp
          const cpC = s0.ei === (shared + 2) % 3 ? s0.cp : s1.cp
          keptTriangles.push([verts[vA], cpA, cpC])
          keptTriangles.push([cpA, verts[vB], verts[vC]])
          keptTriangles.push([cpA, verts[vC], cpC])
        }
        else {
          keptTriangles.push(verts)
        }
      }
      else {
        keptTriangles.push(verts)
      }
      tjSplit++
    }
    if (compId[f] === keepComp)
      mCount++
  }
  console.log('[trimmer-v2] M:', mCount, 'C1:', c1Count, 'tjSplit:', tjSplit, 'total:', keptTriangles.length)

  if (keptTriangles.length === 0) {
    throw new Error('裁切後無三角面保留')
  }
  const result = buildGeometry(keptTriangles)
  debugCheckBoundary(result)
  return result
}

// ── Helper: compute average edge length by sampling ──
function computeAverageEdgeLength(positions, faceCount, faceVerts, sampleSize) {
  const step = Math.max(1, Math.floor(faceCount / sampleSize))
  let totalLen = 0; let count = 0
  for (let f = 0; f < faceCount; f += step) {
    const [i0, i1, i2] = faceVerts(f)
    totalLen += positions[i0].distanceTo(positions[i1])
    totalLen += positions[i1].distanceTo(positions[i2])
    totalLen += positions[i2].distanceTo(positions[i0])
    count += 3
  }
  return count > 0 ? totalLen / count : 0.5
}

// ── Helper: resample boundary along affected segments ──
function resampleBoundarySegments(boundary3D, affectedIndices, step) {
  const bLen = boundary3D.length
  const pts = []
  for (const idx of affectedIndices) {
    const a = boundary3D[idx]
    const b = boundary3D[(idx + 1) % bLen]
    const segLen = a.distanceTo(b)
    const numSteps = Math.max(1, Math.ceil(segLen / step))
    for (let k = 0; k <= numSteps; k++) {
      const t = k / numSteps
      pts.push(new Vector3().lerpVectors(a, b, t))
    }
  }
  // Deduplicate consecutive near-duplicate points
  if (pts.length <= 1)
    return pts
  const deduped = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceTo(pts[i - 1]) > 1e-6)
      deduped.push(pts[i])
  }
  return deduped
}

// ── Helper: project points onto mesh surface via BVH ──
function projectOntoMesh(points, bvh, maxDist) {
  const target = { point: new Vector3(), distance: 0, faceIndex: 0 }
  const projected = []
  for (const pt of points) {
    bvh.closestPointToPoint(pt, target)
    if (target.distance > maxDist)
      continue
    projected.push({ pos: target.point.clone(), faceIndex: target.faceIndex })
  }
  return projected
}

// ── Helper: split a cut face at two crossing points ──
function splitCutFace(verts, isKeep, crossings) {
  const keepCount = isKeep.filter(Boolean).length

  if (keepCount === 1) {
    const kIdx = isKeep.indexOf(true)
    const edgeA = kIdx
    const edgeB = (kIdx + 2) % 3
    const ca = crossings.get(edgeA)
    const cb = crossings.get(edgeB)
    if (!ca || !cb)
      return null
    return [[verts[kIdx], ca.point3D, cb.point3D]]
  }

  if (keepCount === 2) {
    const dIdx = isKeep.indexOf(false)
    const k0 = (dIdx + 1) % 3
    const k1 = (dIdx + 2) % 3
    const edgeA = dIdx
    const edgeB = (dIdx + 2) % 3
    const ca = crossings.get(edgeA)
    const cb = crossings.get(edgeB)
    if (!ca || !cb)
      return null
    return [
      [ca.point3D, verts[k0], verts[k1]],
      [ca.point3D, verts[k1], cb.point3D],
    ]
  }

  return null
}

/**
 * Conform mesh edge vertices to boundary line.
 * Only moves vertices on FREE EDGES (mesh boundary — edges belonging to only 1 triangle),
 * not interior vertices. This keeps deformation minimal.
 */
export function conformMeshToBoundary(geometry, boundaryWorldPoints, matrixWorld, options = {}) {
  const { preBrushBoundary = null, maxSnapDist = 1.0 } = options

  const invMatrix = matrixWorld.clone().invert()
  const boundary3D = boundaryWorldPoints.map(p =>
    new Vector3(p[0], p[1], p[2]).applyMatrix4(invMatrix),
  )
  const bLen = boundary3D.length

  // Affected boundary segments
  const affSegs3D = []
  if (preBrushBoundary) {
    const preBrush3D = preBrushBoundary.map(p =>
      new Vector3(p[0], p[1], p[2]).applyMatrix4(invMatrix),
    )
    const { mask } = computeSegmentAffected(boundary3D, preBrush3D, bLen)
    for (let i = 0; i < bLen; i++) {
      if (mask[i])
        affSegs3D.push([boundary3D[i], boundary3D[(i + 1) % bLen]])
    }
  }
  else {
    for (let i = 0; i < bLen; i++) {
      affSegs3D.push([boundary3D[i], boundary3D[(i + 1) % bLen]])
    }
  }

  if (affSegs3D.length === 0)
    return geometry.clone()

  // Find free-edge vertices (non-indexed geometry: edge shared by only 1 triangle)
  const posAttr = geometry.getAttribute('position')
  const vertCount = posAttr.count
  const faceCount = vertCount / 3
  const PREC = 10000

  // Canonical vertex ID
  const canonId = new Int32Array(vertCount)
  const canonMap = new Map()
  let nextId = 0
  for (let i = 0; i < vertCount; i++) {
    const key = `${Math.round(posAttr.getX(i) * PREC)},${Math.round(posAttr.getY(i) * PREC)},${Math.round(posAttr.getZ(i) * PREC)}`
    let c = canonMap.get(key)
    if (c === undefined) { c = nextId++; canonMap.set(key, c) }
    canonId[i] = c
  }

  // Count edge usage: free edge = used by exactly 1 triangle
  const edgeCount = new Map()
  for (let f = 0; f < faceCount; f++) {
    const c0 = canonId[f * 3]; const c1 = canonId[f * 3 + 1]; const c2 = canonId[f * 3 + 2]
    for (const [a, b] of [[c0, c1], [c1, c2], [c2, c0]]) {
      const ek = a < b ? `${a},${b}` : `${b},${a}`
      edgeCount.set(ek, (edgeCount.get(ek) || 0) + 1)
    }
  }

  // Collect canonical IDs on free edges
  const freeVerts = new Set()
  for (const [ek, count] of edgeCount) {
    if (count === 1) {
      const [a, b] = ek.split(',').map(Number)
      freeVerts.add(a); freeVerts.add(b)
    }
  }
  console.log('[conformer] free-edge vertices:', freeVerts.size)

  if (freeVerts.size === 0)
    return geometry.clone()

  // Snap only free-edge vertices to nearest boundary point
  const newGeo = geometry.clone()
  const newPos = newGeo.getAttribute('position')
  const v = new Vector3()
  let snapped = 0

  for (let i = 0; i < vertCount; i++) {
    if (!freeVerts.has(canonId[i]))
      continue
    v.set(newPos.getX(i), newPos.getY(i), newPos.getZ(i))

    // Find nearest point on affected boundary segments
    let minDist = Infinity
    let nearX = 0; let nearY = 0; let nearZ = 0
    for (const [sa, sb] of affSegs3D) {
      const abx = sb.x - sa.x; const aby = sb.y - sa.y; const abz = sb.z - sa.z
      const apx = v.x - sa.x; const apy = v.y - sa.y; const apz = v.z - sa.z
      const abLenSq = abx * abx + aby * aby + abz * abz
      const t = abLenSq < 1e-14 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / abLenSq))
      const px = sa.x + abx * t; const py = sa.y + aby * t; const pz = sa.z + abz * t
      const dx = v.x - px; const dy = v.y - py; const dz = v.z - pz
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d < minDist) { minDist = d; nearX = px; nearY = py; nearZ = pz }
    }

    if (minDist >= maxSnapDist)
      continue

    newPos.setXYZ(i, nearX, nearY, nearZ)
    snapped++
  }

  console.log('[conformer] snapped:', snapped, '/', freeVerts.size, 'maxSnapDist:', maxSnapDist)
  newPos.needsUpdate = true
  newGeo.computeVertexNormals()
  newGeo.computeBoundingBox()
  newGeo.computeBoundingSphere()
  if (typeof newGeo.computeBoundsTree === 'function')
    newGeo.computeBoundsTree()
  return newGeo
}

// ============================================================

function segmentsIntersect2D(a1, a2, b1, b2) {
  const d1x = a2[0] - a1[0]; const d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0]; const d2y = b2[1] - b1[1]
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-12)
    return false
  const dx = b1[0] - a1[0]; const dy = b1[1] - a1[1]
  const t = (dx * d2y - dy * d2x) / denom
  const u = (dx * d1y - dy * d1x) / denom
  return t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6
}

/** Returns { t, u } or null — t along first segment, u along second */
function segmentIntersect2DParam(a1, a2, b1, b2) {
  const d1x = a2[0] - a1[0]; const d1y = a2[1] - a1[1]
  const d2x = b2[0] - b1[0]; const d2y = b2[1] - b1[1]
  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-12)
    return null
  const dx = b1[0] - a1[0]; const dy = b1[1] - a1[1]
  const t = (dx * d2y - dy * d2x) / denom
  const u = (dx * d1y - dy * d1x) / denom
  if (t > 1e-6 && t < 1 - 1e-6 && u > 1e-6 && u < 1 - 1e-6)
    return { t, u }
  return null
}

function computeSegmentAffected(postBrush3D, preBrush3D, bLen) {
  const MOVE_THRESHOLD = 0.1; const EXPAND = 5
  let maxMovement = 0; let movedCount = 0
  const pointMoved = new Uint8Array(bLen)
  for (let i = 0; i < bLen; i++) {
    let minDist = Infinity
    for (let j = 0; j < preBrush3D.length; j++) {
      const d = postBrush3D[i].distanceTo(preBrush3D[j])
      if (d < minDist)
        minDist = d
    }
    if (minDist > MOVE_THRESHOLD) {
      pointMoved[i] = 1; movedCount++
      if (minDist > maxMovement)
        maxMovement = minDist
    }
  }
  const segRaw = new Uint8Array(bLen)
  for (let i = 0; i < bLen; i++) segRaw[i] = (pointMoved[i] || pointMoved[(i + 1) % bLen]) ? 1 : 0
  const expanded = new Uint8Array(bLen)
  for (let i = 0; i < bLen; i++) {
    if (!segRaw[i])
      continue
    for (let d = -EXPAND; d <= EXPAND; d++) expanded[((i + d) % bLen + bLen) % bLen] = 1
  }
  return { mask: expanded, maxMovement, movedCount }
}

/** Debug: check if geometry boundary forms clean closed loops */
function debugCheckBoundary(geometry) {
  const posAttr = geometry.getAttribute('position')
  const vertCount = posAttr.count
  const faceCount = vertCount / 3
  const PREC = 10000

  const canonMap = new Map()
  const canonId = new Int32Array(vertCount)
  let nextId = 0
  for (let i = 0; i < vertCount; i++) {
    const key = `${Math.round(posAttr.getX(i) * PREC)},${Math.round(posAttr.getY(i) * PREC)},${Math.round(posAttr.getZ(i) * PREC)}`
    let c = canonMap.get(key)
    if (c === undefined) { c = nextId++; canonMap.set(key, c) }
    canonId[i] = c
  }

  // Count edge usage
  const edgeCount = new Map()
  for (let f = 0; f < faceCount; f++) {
    const c0 = canonId[f * 3]; const c1 = canonId[f * 3 + 1]; const c2 = canonId[f * 3 + 2]
    for (const [a, b] of [[c0, c1], [c1, c2], [c2, c0]]) {
      const ek = a < b ? `${a},${b}` : `${b},${a}`
      edgeCount.set(ek, (edgeCount.get(ek) || 0) + 1)
    }
  }

  // Free edges + adjacency
  let freeEdgeCount = 0
  const adj = new Map()
  for (const [ek, count] of edgeCount) {
    if (count === 1) {
      freeEdgeCount++
      const [a, b] = ek.split(',').map(Number)
      if (!adj.has(a))
        adj.set(a, new Set())
      if (!adj.has(b))
        adj.set(b, new Set())
      adj.get(a).add(b)
      adj.get(b).add(a)
    }
  }

  // Check vertex degree
  let deg2 = 0; let degOther = 0
  const badDegrees = []
  for (const [v, neighbors] of adj) {
    if (neighbors.size === 2) {
      deg2++
    }
    else { degOther++; badDegrees.push(`v${v}:deg${neighbors.size}`) }
  }

  // Trace loops
  const visited = new Set()
  const loopSizes = []
  for (const startV of adj.keys()) {
    if (visited.has(startV))
      continue
    const chain = [startV]
    visited.add(startV)
    let prev = startV
    let current = adj.get(startV).values().next().value
    let closed = false
    while (!visited.has(current)) {
      chain.push(current)
      visited.add(current)
      const nbrs = adj.get(current)
      if (!nbrs)
        break
      const cands = [...nbrs].filter(n => n !== prev)
      if (cands.length === 0)
        break
      prev = current
      current = cands[0]
    }
    closed = (current === startV)
    loopSizes.push(closed ? chain.length : -chain.length)
  }

  console.log(`[boundary-check] uniqueVerts:${canonMap.size} freeEdges:${freeEdgeCount} boundaryVerts:${adj.size}`)
  console.log(`[boundary-check] degree-2:${deg2} degree-other:${degOther}`)
  if (badDegrees.length > 0)
    console.log(`[boundary-check] bad degrees: ${badDegrees.slice(0, 20).join(', ')}`)
  console.log(`[boundary-check] loops: [${loopSizes.join(', ')}] (negative=open)`)
}

function buildGeometry(triangles) {
  const posArr = new Float32Array(triangles.length * 9)
  let offset = 0
  for (const [v0, v1, v2] of triangles) {
    posArr[offset++] = v0.x; posArr[offset++] = v0.y; posArr[offset++] = v0.z
    posArr[offset++] = v1.x; posArr[offset++] = v1.y; posArr[offset++] = v1.z
    posArr[offset++] = v2.x; posArr[offset++] = v2.y; posArr[offset++] = v2.z
  }
  const geo = new BufferGeometry()
  geo.setAttribute('position', new BufferAttribute(posArr, 3))
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  if (typeof geo.computeBoundsTree === 'function')
    geo.computeBoundsTree()
  return geo
}
