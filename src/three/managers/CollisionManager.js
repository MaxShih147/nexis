import RBush from 'rbush'
import { Box3, BufferGeometry, Line, LineBasicMaterial, Matrix4, Vector3 } from 'three'

/**
 * CollisionManager — nexis digital-twin interference detection (Problem 1).
 *
 * Phase 0/1 (single fixed floor) — "did it collide?":
 *  - Broad phase: world-space AABB overlap → candidate pairs.
 *  - Narrow phase: three-mesh-bvh `intersectsGeometry()` (exact triangle test).
 *  - Magnitude/Location (approx): overlap AABB volume + centre. Fast enough for
 *    realtime dragging.
 *
 * Phase 2 — "how close / is it safe?" (minimum safety gap):
 *  - When a tolerance ε > 0 is set, non-intersecting candidate pairs within ε
 *    are measured with `closestPointToGeometry()` → exact minimum separation
 *    distance + the two closest points (drawn as a line). Pairs under ε are
 *    flagged `near` (orange); intersecting pairs stay `intersect` (red).
 *
 * Highlighting: the front material is shared across all models, so we swap a
 * per-mesh tinted clone in and restore the original reference on clear.
 */

const INTERSECT_COLOR = 0xFF3B30 // red
const NEAR_COLOR = 0xFFA500 // orange

export class CollisionManager {
  /**
   * @param {object} opts
   * @param {() => import('three').Object3D[]} opts.getModels
   * @param {() => void} opts.render
   * @param {import('three').Scene} [opts.scene]  for the closest-point overlay
   * @param {(results: Array) => void} [opts.onResults]
   */
  constructor({ getModels, getBuildingParts, render, scene, onResults }) {
    this.getModels = getModels
    // Static building parts (walls/columns) to test placed objects against.
    this.getBuildingParts = getBuildingParts || (() => [])
    this.render = render
    this.scene = scene
    this.onResults = onResults || (() => {})

    /** global safety-gap threshold (cm). 0 → pure intersection mode. */
    this.tolerance = 0
    /** per-model safety-gap overrides (uuid → cm). Absent → use global. */
    this.modelTolerances = new Map()
    this.results = []

    /** @type {Map<string, import('three').Material>} uuid → original material */
    this._origMaterial = new Map()
    this._rafPending = false
    this._mat = new Matrix4()

    // Closest-point gap lines currently in the scene (Phase 2 overlay)
    this._overlay = []
  }

  /** World-space AABB of a model (updates its world matrix first). */
  _worldBox(model) {
    model.updateMatrixWorld(true)
    return new Box3().setFromObject(model)
  }

  _ensureBvh(geometry) {
    if (!geometry)
      return false
    if (!geometry.boundsTree && typeof geometry.computeBoundsTree === 'function')
      geometry.computeBoundsTree()
    return !!geometry.boundsTree
  }

  /** Relative matrix transforming B's geometry into A's local frame. */
  _relMatrix(a, b) {
    a.updateMatrixWorld(true)
    b.updateMatrixWorld(true)
    return this._mat.copy(a.matrixWorld).invert().multiply(b.matrixWorld)
  }

  /** Exact triangle-level intersection test between two model meshes. */
  _intersects(a, b) {
    const ga = a.geometry
    const gb = b.geometry
    if (!this._ensureBvh(ga) || !gb)
      return false
    return ga.boundsTree.intersectsGeometry(gb, this._relMatrix(a, b))
  }

  /**
   * Minimum separation between two meshes via BVH closest-point query.
   * @returns {{ distance: number, pointA: Vector3, pointB: Vector3 } | null}
   */
  _closest(a, b, maxThreshold = Infinity) {
    const ga = a.geometry
    const gb = b.geometry
    if (!this._ensureBvh(ga) || !gb)
      return null

    const rel = this._relMatrix(a, b)
    const t1 = { point: new Vector3(), distance: 0, faceIndex: -1 }
    const t2 = { point: new Vector3(), distance: 0, faceIndex: -1 }
    const hit = ga.boundsTree.closestPointToGeometry(gb, rel, t1, t2, 0, maxThreshold)
    if (!hit)
      return null

    // t1.point is in A-local, t2.point is in B-local → lift both to world so the
    // gap is correct even under non-uniform scale.
    const pointA = t1.point.clone().applyMatrix4(a.matrixWorld)
    const pointB = t2.point.clone().applyMatrix4(b.matrixWorld)
    return { distance: pointA.distanceTo(pointB), pointA, pointB }
  }

  /** Approx interference magnitude/location from the overlap AABB. */
  _overlapInfo(boxA, boxB) {
    const inter = boxA.clone().intersect(boxB)
    if (inter.isEmpty())
      return { magnitude: 0, location: null }
    const size = inter.getSize(new Vector3())
    const center = inter.getCenter(new Vector3())
    return {
      magnitude: Math.abs(size.x * size.y * size.z),
      location: { x: center.x, y: center.y, z: center.z },
    }
  }

  /** Friendly label: building parts read as 牆/柱, otherwise the model name. */
  _label(obj) {
    const part = obj.userData?.buildingPart
    if (part === 'wall')
      return '牆'
    if (part === 'column')
      return '柱'
    return obj.name || 'model'
  }

  _intersectPair(a, b, boxA, boxB) {
    const info = this._overlapInfo(boxA, boxB)
    return {
      aUuid: a.uuid,
      bUuid: b.uuid,
      aName: this._label(a),
      bName: this._label(b),
      status: 'intersect',
      magnitude: info.magnitude,
      gap: 0,
      location: info.location,
      pointA: null,
      pointB: null,
    }
  }

  _nearPair(a, b, closest) {
    const mid = closest.pointA.clone().add(closest.pointB).multiplyScalar(0.5)
    return {
      aUuid: a.uuid,
      bUuid: b.uuid,
      aName: this._label(a),
      bName: this._label(b),
      status: 'near',
      magnitude: 0,
      gap: closest.distance,
      location: { x: mid.x, y: mid.y, z: mid.z },
      pointA: closest.pointA,
      pointB: closest.pointB,
    }
  }

  /** Effective safety gap for a model: its override if set, else the global ε. */
  _modelTol(uuid) {
    return this.modelTolerances.has(uuid) ? this.modelTolerances.get(uuid) : this.tolerance
  }

  /** A pair's safety gap is the larger of the two models' effective gaps. */
  _pairTol(a, b) {
    return Math.max(this._modelTol(a.uuid), this._modelTol(b.uuid))
  }

  /**
   * Evaluate one ordered pair. Returns an intersect result, a near result
   * (only when the pair's safety gap > 0 and the gap is under it), or null.
   */
  _evaluate(a, b, boxA, boxB) {
    const tol = this._pairTol(a, b)

    // Broad phase: pairs farther apart than the gap can be neither intersecting
    // nor within the safety gap.
    if (tol > 0) {
      const grown = boxB.clone().expandByScalar(tol)
      if (!boxA.intersectsBox(grown))
        return null
    }
    else if (!boxA.intersectsBox(boxB)) {
      return null
    }

    if (this._intersects(a, b))
      return this._intersectPair(a, b, boxA, boxB)

    if (tol > 0) {
      const closest = this._closest(a, b, tol)
      if (closest && closest.distance < tol)
        return this._nearPair(a, b, closest)
    }
    return null
  }

  /** Largest safety gap in play — broadens the broad-phase query conservatively. */
  _maxTolerance() {
    let m = this.tolerance
    for (const v of this.modelTolerances.values())
      m = Math.max(m, v)
    return m
  }

  /**
   * Full scan: object-vs-object (every model pair) plus object-vs-building
   * (every model against each static wall/column). Building parts are never
   * tested against each other.
   *
   * Broad phase uses an R-tree (rbush) over XY footprints so we only narrow-test
   * spatially-near pairs — near-linear instead of O(n²). The exact AABB + BVH
   * test still runs per candidate in _evaluate, so results are unchanged.
   */
  checkAll() {
    const models = this.getModels().filter(m => m.geometry)
    const parts = this.getBuildingParts().filter(m => m.geometry)
    const mBoxes = models.map(m => this._worldBox(m))
    const pBoxes = parts.map(m => this._worldBox(m))
    const pad = this._maxTolerance()
    const results = []

    const fp = (box, i) => ({ minX: box.min.x, minY: box.min.y, maxX: box.max.x, maxY: box.max.y, i })

    const modelTree = new RBush()
    modelTree.load(mBoxes.map((b, i) => fp(b, i)))

    const partTree = new RBush()
    if (parts.length)
      partTree.load(pBoxes.map((b, k) => fp(b, k)))

    for (let i = 0; i < models.length; i++) {
      const b = mBoxes[i]
      const query = { minX: b.min.x - pad, minY: b.min.y - pad, maxX: b.max.x + pad, maxY: b.max.y + pad }

      // object vs object — only candidates with a higher index (dedupe pairs)
      for (const cand of modelTree.search(query)) {
        if (cand.i <= i)
          continue
        const r = this._evaluate(models[i], models[cand.i], b, mBoxes[cand.i])
        if (r)
          results.push(r)
      }
      // object vs building
      if (parts.length) {
        for (const cand of partTree.search(query)) {
          const r = this._evaluate(models[i], parts[cand.i], b, pBoxes[cand.i])
          if (r)
            results.push(r)
        }
      }
    }

    this._setResults(results)
    return results
  }

  /**
   * Incremental scan for realtime drag: keep all pairs that don't involve
   * `uuid`, and recompute only `uuid` vs every other model and the building.
   */
  checkFor(uuid) {
    const models = this.getModels().filter(m => m.geometry)
    const target = models.find(m => m.uuid === uuid)
    if (!target)
      return this.checkAll()

    const targetBox = this._worldBox(target)
    const kept = this.results.filter(r => r.aUuid !== uuid && r.bUuid !== uuid)
    const fresh = []

    for (const other of models) {
      if (other.uuid === uuid)
        continue
      const r = this._evaluate(target, other, targetBox, this._worldBox(other))
      if (r)
        fresh.push(r)
    }
    for (const part of this.getBuildingParts()) {
      if (!part.geometry)
        continue
      const r = this._evaluate(target, part, targetBox, this._worldBox(part))
      if (r)
        fresh.push(r)
    }

    this._setResults([...kept, ...fresh])
    return this.results
  }

  /**
   * Live incremental check, throttled to one per animation frame. Always on:
   * called from the scene's drag/transform handlers so interference updates as
   * a movable object is moved (Problem 1, goal 2).
   */
  requestRealtimeCheck(uuid) {
    if (this._rafPending)
      return
    this._rafPending = true
    requestAnimationFrame(() => {
      this._rafPending = false
      if (uuid)
        this.checkFor(uuid)
      else
        this.checkAll()
    })
  }

  /** Set the global safety-gap threshold and re-scan. */
  setTolerance(value) {
    this.tolerance = Math.max(0, Number(value) || 0)
    this.checkAll()
    return this.tolerance
  }

  /** Set (or clear, with null) a per-model safety-gap override and re-scan. */
  setModelTolerance(uuid, value) {
    if (value == null)
      this.modelTolerances.delete(uuid)
    else
      this.modelTolerances.set(uuid, Math.max(0, Number(value) || 0))
    this.checkAll()
    return this.modelTolerances.get(uuid)
  }

  clear() {
    this._setResults([])
  }

  _setResults(results) {
    this.results = results

    // intersect (red) takes priority over near (orange) for a shared model
    const colorByUuid = new Map()
    for (const r of results) {
      if (r.status !== 'near')
        continue
      colorByUuid.set(r.aUuid, NEAR_COLOR)
      colorByUuid.set(r.bUuid, NEAR_COLOR)
    }
    for (const r of results) {
      if (r.status !== 'intersect')
        continue
      colorByUuid.set(r.aUuid, INTERSECT_COLOR)
      colorByUuid.set(r.bUuid, INTERSECT_COLOR)
    }

    this._applyHighlight(colorByUuid)
    this._rebuildOverlay(results)
    this.onResults(results)
    this.render()
  }

  /** Swap tinted material clones in for hit parts (models + building); restore the rest. */
  _applyHighlight(colorByUuid) {
    const models = [...this.getModels(), ...this.getBuildingParts()]

    // Restore parts that are no longer highlighted
    for (const [uuid, original] of [...this._origMaterial]) {
      if (colorByUuid.has(uuid))
        continue
      const model = models.find(m => m.uuid === uuid)
      if (model) {
        const tinted = model.material
        model.material = original
        if (tinted && tinted !== original)
          tinted.dispose?.()
      }
      this._origMaterial.delete(uuid)
    }

    // Tint / re-tint highlighted models
    for (const [uuid, color] of colorByUuid) {
      const model = models.find(m => m.uuid === uuid)
      if (!model || !model.material)
        continue
      if (!this._origMaterial.has(uuid)) {
        this._origMaterial.set(uuid, model.material)
        model.material = model.material.clone()
      }
      model.material.color?.set?.(color)
    }
  }

  /** Draw a line between the closest points of each `near` pair. */
  _rebuildOverlay(results) {
    if (!this.scene)
      return
    // Tear down previous overlay lines
    for (const line of this._overlay) {
      this.scene.remove(line)
      line.geometry?.dispose?.()
      line.material?.dispose?.()
    }
    this._overlay = []

    for (const r of results) {
      if (r.status !== 'near' || !r.pointA || !r.pointB)
        continue
      const geo = new BufferGeometry().setFromPoints([r.pointA, r.pointB])
      const line = new Line(geo, new LineBasicMaterial({ color: NEAR_COLOR, depthTest: false, transparent: true }))
      line.name = 'collisionGapLine'
      line.renderOrder = 999
      this.scene.add(line)
      this._overlay.push(line)
    }
  }

  dispose() {
    this._applyHighlight(new Map())
    this._rebuildOverlay([])
    this.results = []
  }
}
