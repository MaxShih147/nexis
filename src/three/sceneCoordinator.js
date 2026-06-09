import { useCollisionStore } from '@/stores/collision'
import { useModelStore } from '@/stores/model'
import { useGeneralStore } from '@/stores/state'
import { useParamsStore } from '@/stores/useParamsStore'
import { CollisionManager } from '@/three/managers/CollisionManager'
import { ControlsManager } from '@/three/managers/ControlsManager'
import { FaceSelectionManager } from '@/three/managers/FaceSelectionManager'
import { MeshManager } from '@/three/managers/MeshManager'
import { SelectionManager } from '@/three/managers/SelectionManager'
import { logger } from '@/utils/logger'
import { storeToRefs } from 'pinia'
import { Box3, Color, Object3D, Vector3 } from 'three'
import { watch } from 'vue'
import { createBuildVolumeBox, getObjectWorldBounds, isBoxOutOfBuildVolume } from './buildVolume'
import {
  captureGeometrySnapshot,
  createAddModelCommand,
  createGeometryCommand,
  createPositionCommand,
  createRemoveModelCommand,
  createRotationCommand,
  createScaleCommand,
} from './commands/index.js'
import { computeFloorSize, generateBuilding } from './building/BuildingGenerator'
import { createBaseScene, createPlane, resizePlane } from './createBaseScene'
import { ProjectManager } from './project/ProjectManager.js'
import { GeometrySnapshotService } from './snapshots/GeometrySnapshotService.js'
import { IndexedDBSnapshotStore } from './snapshots/IndexedDBSnapshotStore.js'
import { UndoManager } from './UndoManager.js'
import { WorkerPool } from './workers/workerPool.js'

// nexis: 3D-printing engine removed. This coordinator is a pure viewer/edit core:
// scene + camera + controls, mesh loading (with three-mesh-bvh), selection,
// transform (translate/rotate/scale + free drag), clipping plane, build-volume
// bounds, undo/redo, and project load/save. The former Slicer / Support / Hollow /
// TextEmboss / Drill managers and the auto-orient / ortho pipelines have been
// dropped along with their web-slicer-core backend calls.

// set the default up vector to z-axis
Object3D.DEFAULT_UP = new Vector3(0, 0, 1)
// 先不用ZYX，因為這樣會沒有local rotation
// Euler.DEFAULT_ORDER = 'ZYX'

const TRANSFORM_CONTROL_MODES = ['translate', 'rotate', 'scale']

/**
 * Creates a scene coordinator with all required managers and handlers
 * @param {HTMLElement} container - The DOM element to render the scene in
 * @returns {object} API for interacting with the scene
 */
export function createSceneCoordinator(container) {
  const modelStore = useModelStore()
  // Clear stale store entries on scene re-init (e.g. Vite HMR rebuild)
  modelStore.clearAll()
  const generalStore = useGeneralStore()
  const paramsStore = useParamsStore()
  const collisionStore = useCollisionStore()
  const { bedSize, buildHeight } = storeToRefs(paramsStore)

  // Initialize base scene components
  const { scene, camera, renderer, plane, axisHelper, clippingPlane } = createBaseScene(container)

  // Initialize managers
  const { cameraControl, transformControl, dragControl } = new ControlsManager(camera, renderer)
  const selectionManager = new SelectionManager(scene, camera, renderer.domElement)

  // Attach axis helper to camera control
  axisHelper.attachControls(cameraControl)

  // Render function - kept as pure as possible
  const render = () => {
    renderer.render(scene, camera)
    axisHelper.render()
  }

  // Setup mesh manager
  const meshManager = new MeshManager(scene, modelStore, dragControl, selectionManager, render, plane)
  const faceSelectionManager = new FaceSelectionManager(selectionManager, render, modelStore, meshManager.setToBottom.bind(meshManager))
  meshManager.setFaceSelectionManager(faceSelectionManager)

  // Building shell (procedural walls + columns) — declared here so collision
  // detection can test placed objects against the static building parts.
  let _building = null
  function getBuildingParts() {
    if (!_building)
      return []
    const parts = []
    _building.traverse((o) => {
      if (o.isMesh && o.userData?.buildingPart)
        parts.push(o)
    })
    return parts
  }

  // Collision detection (digital-twin interference, Problem 1)
  const collisionManager = new CollisionManager({
    getModels: meshManager.getModels.bind(meshManager),
    getBuildingParts,
    render,
    scene,
    onResults: results => collisionStore.setResults(results),
  })

  // Sync build volume for out-of-bounds visualization
  watch([bedSize, buildHeight], ([bed, height]) => {
    if (bed?.[0] && bed?.[1] && height) {
      meshManager.setBuildVolume(bed[0], bed[1], height)
    }
  }, { immediate: true })

  function getBuildVolumeBox() {
    const [width = 0, height = 0] = bedSize.value || []
    return createBuildVolumeBox(width, height, buildHeight.value || 0)
  }

  function getOutOfBuildVolumeModels() {
    const buildVolumeBox = getBuildVolumeBox()

    return meshManager.getModels().filter((model) => {
      const modelBounds = getObjectWorldBounds(model)
      return isBoxOutOfBuildVolume(modelBounds, buildVolumeBox)
    })
  }

  function hasOutOfBuildVolumeModels() {
    return getOutOfBuildVolumeModels().length > 0
  }

  // Setup axis helper
  axisHelper.attachControls(cameraControl)
  axisHelper.updateOrientation()
  axisHelper.setRenderCallback(render)

  // Add transform control to scene
  scene.add(transformControl.getHelper())

  // ── Undo/Redo system ──
  const workerPool = new WorkerPool(2)
  const snapshotStore = new IndexedDBSnapshotStore()
  const snapshotService = new GeometrySnapshotService(workerPool, snapshotStore)
  const undoManager = new UndoManager({ snapshotService })

  // Helpers used by commands to sync store & render
  const _syncStore = () => modelStore.syncSelectedModel()

  // Gizmo drag state tracking (for capturing before/after transforms)
  let _gizmoDragState = null
  let _dragControlState = null

  // Setup event handlers
  _setupEventHandlers()

  /**
   * Sets up all event handlers for the scene coordinator
   */
  function _setupEventHandlers() {
    // Selection handling
    selectionManager.onSelect = _handleObjectSelection
    selectionManager.onDoubleClickObject = _handleObjectDoubleClick
    selectionManager.onDeselect = _handleObjectDeselection
    // Prevent deselection when a gizmo handle was just clicked.
    // TransformControls registers pointerdown before SelectionManager, so
    // by the time SelectionManager runs, dragging is already true if a handle was hit.
    selectionManager.shouldDeselect = () => !transformControl.dragging

    // Camera and transform control events
    cameraControl.addEventListener('change', render)
    transformControl.addEventListener('change', _handleTransformChange)
    dragControl.addEventListener('drag', _handleDragChange)

    // ── Undo hooks: capture gizmo drag start/end ──
    transformControl.addEventListener('dragging-changed', (event) => {
      if (event.value) {
        // Drag start — snapshot current transform
        const object = transformControl.object
        if (object) {
          _gizmoDragState = {
            mode: transformControl.getMode(),
            object,
            position: object.position.clone(),
            rotation: object.rotation.clone(),
            scale: object.scale.clone(),
          }
        }
      }
      else {
        // Drag end — create and push command
        if (_gizmoDragState) {
          const { mode, object } = _gizmoDragState
          if (mode === 'translate') {
            undoManager.push(createPositionCommand(
              object,
              _gizmoDragState.position,
              object.position.clone(),
              _syncStore,
              render,
            ))
          }
          else if (mode === 'rotate') {
            undoManager.push(createRotationCommand(
              object,
              _gizmoDragState.rotation,
              object.rotation.clone(),
              _syncStore,
              render,
            ))
          }
          else if (mode === 'scale') {
            undoManager.push(createScaleCommand(
              object,
              _gizmoDragState.scale,
              object.scale.clone(),
              _syncStore,
              render,
            ))
          }
          _gizmoDragState = null
        }
      }
    })

    // ── Undo hooks: capture drag control (free-drag) start/end ──
    dragControl.addEventListener('dragstart', (event) => {
      const object = event.object
      if (object) {
        _dragControlState = {
          object,
          position: object.position.clone(),
        }
      }
    })
    dragControl.addEventListener('dragend', () => {
      if (_dragControlState) {
        const { object, position: oldPos } = _dragControlState
        undoManager.push(createPositionCommand(
          object,
          oldPos,
          object.position.clone(),
          _syncStore,
          render,
        ))
        _dragControlState = null
      }
    })
  }

  /**
   * Handles object selection
   * @param {Object3D} object - The selected object
   */
  function _handleObjectSelection(object, modifiers = {}) {
    _applySelectionFor(object, modifiers)
  }

  /**
   * Compute the new selection set from a clicked/target object + modifier keys,
   * then commit it. Cmd/Ctrl/Shift = toggle into the set; plain click = replace.
   * @param {Object3D} object
   * @param {{ additive?: boolean }} [modifiers]
   */
  function _applySelectionFor(object, modifiers = {}) {
    let uuids = [...modelStore.selectedUuids]
    if (modifiers.additive) {
      uuids = uuids.includes(object.uuid)
        ? uuids.filter(u => u !== object.uuid) // toggle off
        : [...uuids, object.uuid] // add to set
    }
    else {
      uuids = [object.uuid] // replace
    }
    _commitSelection(uuids)
  }

  /**
   * Apply a selection set: sync store (set + primary), the SelectionManager
   * pointer, and the gizmo (attached only when exactly one model is selected).
   * @param {string[]} uuids
   */
  function _commitSelection(uuids) {
    modelStore.setSelectedUuids(uuids)
    const models = meshManager.getModels()
    const primaryUuid = uuids[uuids.length - 1] || null
    const primary = primaryUuid ? models.find(m => m.uuid === primaryUuid) : null

    // Keep the SelectionManager primary pointer in sync without re-firing onSelect
    selectionManager.selectedObject = primary || null

    if (primary)
      modelStore.selectModel(primary.uuid)
    else
      modelStore.deselectModel()

    // Gizmo: only for a single selected model
    const single = uuids.length === 1 && primary
    if (single && TRANSFORM_CONTROL_MODES.includes(generalStore.controlMode)) {
      transformControl.setMode(generalStore.controlMode)
      transformControl.attach(primary)
    }
    else {
      transformControl.detach()
    }

    // Draw/refresh the multi-selection outlines (also renders)
    meshManager.updateSelectionHighlights(uuids)
  }

  /**
   * Select a model by uuid (used by the sidebar list). Respects modifier keys.
   * @param {string} uuid
   * @param {{ additive?: boolean }} [modifiers]
   */
  function selectModelByUuid(uuid, modifiers = {}) {
    const object = meshManager.getModels().find(m => m.uuid === uuid)
    if (object)
      _applySelectionFor(object, modifiers)
  }

  /**
   * Replace the selection set with the given uuids (used by the list's multi
   * selection binding, which already applied its own modifier logic).
   * @param {string[]} uuids
   */
  function setSelectedModels(uuids) {
    _commitSelection(Array.isArray(uuids) ? uuids : [])
  }

  /** Select every model in the scene (Cmd/Ctrl+A). */
  function selectAllModels() {
    _commitSelection(meshManager.getModels().map(m => m.uuid))
  }

  /**
   * @returns {string[]} uuids of all currently selected models
   */
  function getSelectedModelUuids() {
    return [...modelStore.selectedUuids]
  }

  /**
   * Handles object double click
   * @param {Object3D} object - The double-clicked object
   */
  function _handleObjectDoubleClick(object) {
    transformControl.attach(object)
    setTransformMode('rotate')
  }

  /**
   * Handles object deselection
   */
  function _handleObjectDeselection() {
    transformControl.detach()
    dragControl.connect()
    modelStore.deselectModel()
    modelStore.setSelectedUuids([])
    meshManager.updateSelectionHighlights([])
    render()
  }

  /**
   * Handles transform control changes
   */
  function _handleTransformChange() {
    if (modelStore.selectedModel && modelStore.selectedModel.Object3D) {
      modelStore.syncSelectedModel()
      // Keep the selection outline fitted to the transformed model
      meshManager.refreshSelectionHighlights()
      collisionManager.requestRealtimeCheck(modelStore.selectedModel.uuid)
    }
    render()
  }

  /**
   * Handles drag control changes
   */
  function _handleDragChange() {
    if (modelStore.selectedModel && modelStore.selectedModel.Object3D) {
      modelStore.syncSelectedModel()
      // Keep the selection outline fitted to the dragged model
      meshManager.refreshSelectionHighlights()
      collisionManager.requestRealtimeCheck(modelStore.selectedModel.uuid)
    }
    render()
  }

  function subscribeFaceSelectionModeChange(handler) {
    if (typeof handler !== 'function')
      return () => {}

    return faceSelectionManager.onModeChange(() => {
      handler({
        isLayOnFaceModeActive: faceSelectionManager.isLayOnFaceModeActive(),
        isFaceOnTopModeActive: faceSelectionManager.isFaceOnTopModeActive(),
      })
    })
  }

  /**
   * Sets the scene background color
   * @param {string} color - Background color
   */
  function setSceneColor(color) {
    scene.background = new Color(color)
    render()
  }

  /**
   * Sets the current transformation mode for the scene
   * @param {'drag'|'translate'|'rotate'|'scale'} mode - The mode to set
   */
  function setTransformMode(mode) {
    // Update the global store with current control mode
    generalStore.controlMode = mode

    transformControl.enabled = true
    dragControl.connect()

    const models = meshManager.getModels()
    if (models.length === 0) {
      return
    }

    // Configure transform controls based on mode
    const isTransformMode = TRANSFORM_CONTROL_MODES.includes(mode)

    if (!isTransformMode) {
      transformControl.detach()
    }
    else {
      transformControl.setMode(mode)
      const targetObject = selectionManager.selectedObject || models[0]
      transformControl.attach(targetObject)
    }

    render()
  }

  function clip(percent) {
    const models = meshManager.getModels()
    if (models.length === 0) {
      return
    }
    const modelsBB = new Box3().setFromObject(models[0], true)
    for (const model of models) {
      modelsBB.expandByObject(model)
    }
    clippingPlane.constant = modelsBB.max.z * percent / 100 + 1
    render()
  }

  function changePrintBedSize(width, height) {
    if (!width || !height)
      return

    const existingPlane = scene.getObjectByName('plane')
    if (existingPlane) {
      if (resizePlane(existingPlane, width, height))
        axisHelper.render()
    }
    else {
      scene.add(createPlane(width, height))
    }
    render()
  }

  // ── Building shell (procedural walls + columns) ──
  // `_building` + getBuildingParts() are declared earlier (collision needs them).

  function clearBuilding() {
    if (!_building)
      return
    scene.remove(_building)
    _building.traverse((child) => {
      child.geometry?.dispose?.()
      const mat = child.material
      if (Array.isArray(mat))
        mat.forEach(m => m?.dispose?.())
      else
        mat?.dispose?.()
    })
    _building = null
    collisionManager.requestRealtimeCheck(null)
    render()
  }

  /** Frame the camera so a square-ish floor of side `s` (with walls) fits, and
   * size the near/far clip planes to the scene so orbiting/zooming never clips. */
  function frameToFloor(width, height, wallHeight = 0) {
    const s = Math.max(width, height)
    camera.position.set(-s * 1.05, -s * 1.05, s * 0.75 + wallHeight)
    cameraControl.target.set(0, 0, wallHeight * 0.5)
    // Adaptive clip planes: small near for close inspection, generous far so a
    // full orbit / zoom-out of a large building stays inside the frustum.
    camera.near = Math.max(1, s * 0.004)
    camera.far = s * 24 + wallHeight * 4
    camera.updateProjectionMatrix()
    cameraControl.update()
  }

  function regenerateBuilding(params = {}) {
    clearBuilding()
    // The platform follows the building: size the floor to fit the rooms.
    const { width, height } = computeFloorSize(params)
    if (resizePlane(plane, width, height))
      axisHelper.render()

    _building = generateBuilding({ ...params, floorWidth: width, floorDepth: height })
    scene.add(_building)
    frameToFloor(width, height, _building.userData?.params?.wallHeight ?? 0)
    // Re-evaluate interference of existing objects against the new building.
    collisionManager.requestRealtimeCheck(null)
    render()
    return _building.userData
  }

  function addModelsToScene() {
    for (const model of meshManager.getModels()) {
      if (!scene.children.includes(model)) {
        scene.add(model)
      }
    }
    render()
    generalStore.checkScene = false
  }

  function removeModel(uuid) {
    // Find the model object before removal for undo
    const models = meshManager.getModels()
    const object = models.find(m => m.uuid === uuid)

    // Ensure transform control is detached before removing the model
    if (transformControl.object?.uuid === uuid) {
      transformControl.detach()
    }

    // Keep selection manager state in sync
    if (selectionManager.selectedObject?.uuid === uuid) {
      selectionManager.deselectObject()
    }

    if (object) {
      undoManager.beginTransaction('Remove Model')
      // Use soft-remove + push undo command (no geometry disposal)
      meshManager._softRemoveModel(object)
      undoManager.push(createRemoveModelCommand(object, meshManager, render))
      undoManager.commitTransaction()
      // Re-evaluate interference after the model leaves the scene
      collisionManager.requestRealtimeCheck(null)
      render()
      return true
    }

    return meshManager.removeModel(uuid)
  }

  // ── Undo-aware API wrappers ──

  /**
   * Wrap updatePosition so that calls from UI inputs push undo commands.
   * Uses merge (300ms) for rapid slider/input changes.
   */
  function undoUpdatePosition(position, object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return
    const oldPos = target.position.clone()
    meshManager.updatePosition(position, target)
    undoManager.push(createPositionCommand(target, oldPos, target.position.clone(), _syncStore, render))
  }

  function undoUpdateRotation(rotation, object, order) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return
    const oldRot = target.rotation.clone()
    meshManager.updateRotation(rotation, target, order)
    undoManager.push(createRotationCommand(target, oldRot, target.rotation.clone(), _syncStore, render))
  }

  function undoUpdateScale(scale, lockRatio, object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return
    const oldScale = target.scale.clone()
    meshManager.updateScale(scale, lockRatio, target)
    undoManager.push(createScaleCommand(target, oldScale, target.scale.clone(), _syncStore, render))
  }

  function undoSetToCenter(object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return
    const oldPos = target.position.clone()
    meshManager.setToCenter(target)
    undoManager.push(createPositionCommand(target, oldPos, target.position.clone(), _syncStore, render))
  }

  function undoSetToBottom(object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return
    const oldPos = target.position.clone()
    meshManager.setToBottom(target)
    const newPos = target.position.clone()
    // Only push if position actually changed
    if (oldPos.z !== newPos.z) {
      undoManager.push(createPositionCommand(target, oldPos, newPos, _syncStore, render))
    }
  }

  function undoMirrorModel(axis, clone, object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return null

    if (clone) {
      undoManager.beginTransaction('Mirror (Clone)')
      const result = meshManager.mirrorModel(axis, true, target)
      if (result) {
        undoManager.push(createAddModelCommand(result, meshManager, render))
      }
      undoManager.commitTransaction()
      return result
    }

    const oldScale = target.scale.clone()
    const result = meshManager.mirrorModel(axis, false, target)
    if (result) {
      undoManager.push(createScaleCommand(target, oldScale, target.scale.clone(), _syncStore, render))
    }
    return result
  }

  function undoExpandModel(object) {
    const target = object || selectionManager.selectedObject
    if (!target)
      return

    undoManager.beginTransaction('Expand')
    const oldScale = target.scale.clone()
    const oldPos = target.position.clone()
    meshManager.expandModel(target)
    const newScale = target.scale.clone()
    const newPos = target.position.clone()
    undoManager.push(createScaleCommand(target, oldScale, newScale, _syncStore, render))
    if (oldPos.x !== newPos.x || oldPos.y !== newPos.y || oldPos.z !== newPos.z) {
      undoManager.push(createPositionCommand(target, oldPos, newPos, _syncStore, render))
    }
    undoManager.commitTransaction()
  }

  async function undoLoadModel(file) {
    const mesh = await meshManager.loadModel(file)
    if (mesh) {
      undoManager.push(createAddModelCommand(mesh, meshManager, render))
      collisionManager.requestRealtimeCheck(null)
    }
    return mesh
  }

  /**
   * Load several files as one import: load all geometry without placing, then
   * pack the whole batch together into free space (existing models untouched).
   * Each model is pushed as its own add-model undo command.
   * @param {File[]} files
   * @returns {Promise<import('three').Object3D[]>} the loaded meshes
   */
  async function undoLoadModels(files) {
    const list = Array.from(files || [])
    if (list.length === 0)
      return []
    if (list.length === 1)
      return [await undoLoadModel(list[0])].filter(Boolean)

    const meshes = []
    for (const file of list) {
      const mesh = await meshManager.loadModel(file, { autoPlace: false })
      if (mesh) {
        undoManager.push(createAddModelCommand(mesh, meshManager, render))
        meshes.push(mesh)
      }
    }
    meshManager.placeNewModelsBatch(meshes)
    collisionManager.requestRealtimeCheck(null)
    return meshes
  }

  function undoAddShape(name, params) {
    const mesh = meshManager.addShape(name, params)
    if (mesh) {
      undoManager.push(createAddModelCommand(mesh, meshManager, render))
      collisionManager.requestRealtimeCheck(null)
    }
    return mesh
  }

  /**
   * Scatter `count` random boxes across the floor — simulates "system A"
   * placing objects, and a quick way to stress collision detection. Random
   * size + position; overlaps are intentional so interference shows up.
   * @param {number} count
   */
  function scatterRandomObjects(count = 20) {
    const w = plane.size?.x || 300
    const d = plane.size?.y || 300
    const halfW = w / 2
    const halfD = d / 2

    // Skewed size distribution — small objects dominate (more realistic):
    //   70% smallest (longest edge ≤ 40 cm)
    //   15%          (≤ 80 cm)
    //   10%          (≤ 130 cm)
    //    5% largest  (≤ 200 cm)
    // Per object pick a max-edge class, then vary each edge within [10, max] cm
    // so boxes stay non-uniform (equipment/shelves) rather than cubes.
    const pickMaxEdge = () => {
      const r = Math.random()
      if (r < 0.70)
        return 40
      if (r < 0.85)
        return 80
      if (r < 0.95)
        return 130
      return 200
    }
    // Suppress per-object renders during the batch (each is a full-scene draw
    // that grows with the scene → ~O(n²)); render once at the end.
    const realRender = meshManager.render
    meshManager.render = () => {}
    undoManager.beginTransaction('Scatter objects')
    try {
      for (let i = 0; i < count; i++) {
        const maxEdge = pickMaxEdge()
        const edge = () => 10 + Math.random() * (maxEdge - 10)
        const width = edge()
        const height = edge()
        const depth = edge()
        const mesh = meshManager.addShape('Box', { width, height, depth })
        if (!mesh)
          continue
        const x = (Math.random() * 2 - 1) * Math.max(0, halfW - width / 2)
        const y = (Math.random() * 2 - 1) * Math.max(0, halfD - height / 2)
        meshManager.updatePosition({ x, y, z: mesh.position.z }, mesh)
        undoManager.push(createAddModelCommand(mesh, meshManager, render))
      }
    }
    finally {
      meshManager.render = realRender
    }
    undoManager.commitTransaction()
    collisionManager.requestRealtimeCheck(null)
    render()
  }

  async function undoReplaceModelGeometryWithLabel(model, stlBlob, label = 'common.commandLabels.replaceGeometry') {
    const oldSnapshot = await captureGeometrySnapshot(model, snapshotService)
    await meshManager.replaceModelGeometry(model, stlBlob)
    const newSnapshot = await captureGeometrySnapshot(model, snapshotService)
    undoManager.push(createGeometryCommand({
      label,
      object: model,
      oldSnapshot,
      newSnapshot,
      snapshotService,
      syncStore: _syncStore,
      render,
    }))
  }

  // ── Scene clear & project support ──

  /**
   * Remove all models from the scene and reset app state.
   * Used by ProjectManager for new/open project.
   */
  function clearScene() {
    // Detach transform controls
    transformControl.detach()

    // Remove all models (iterate copy to avoid mutation during loop)
    const models = meshManager.getModels()
    for (const model of models) {
      meshManager._softRemoveModel(model)
    }

    // Clear undo history
    undoManager.clear()

    // Reset store state
    generalStore.controlMode = 'drag'
    collisionManager.clear()

    render()
  }

  /**
   * Add a pre-built mesh to the scene directly (used by ProjectReader).
   * Does NOT push undo commands.
   * @param {Object3D} mesh
   */
  function _addModelDirect(mesh) {
    scene.add(mesh)
    meshManager._registerModel(mesh)
    render()
  }

  /**
   * Get current camera state for serialization.
   * @returns {{ position: {x,y,z}, target: {x,y,z} }} The current camera position and orbit target.
   */
  function getCameraState() {
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: cameraControl.target.x, y: cameraControl.target.y, z: cameraControl.target.z },
    }
  }

  /**
   * Restore camera position and orbit target.
   * @param {{ position: {x,y,z}, target?: {x,y,z} }} state
   */
  function restoreCamera(state) {
    if (state.position) {
      camera.position.set(state.position.x, state.position.y, state.position.z)
    }
    if (state.target) {
      cameraControl.target.set(state.target.x, state.target.y, state.target.z)
    }
    cameraControl.update()
    render()
  }

  // ── Dev-only diagnostics ──
  if (import.meta.env.DEV) {
    window.__undoTimings = () => snapshotService.getTimingStats()

    window.__undoStressTest = async (opts = {}) => {
      const {
        iterations = 100,
        geometryVertices = 500000,
        logTimings = true,
      } = opts

      const { BufferGeometry: BG, Float32BufferAttribute: F32 } = await import('three')
      logger.log(`[UndoStressTest] Starting ${iterations} iterations, ${geometryVertices} verts each`)

      for (let i = 0; i < iterations; i++) {
        // Generate random geometry
        const pos = new Float32Array(geometryVertices * 3)
        for (let j = 0; j < pos.length; j++) pos[j] = Math.random() * 100
        const geom = new BG()
        geom.setAttribute('position', new F32(pos, 3))
        geom.computeVertexNormals()

        const ref = await snapshotService.snapshotGeometry(geom)
        const restored = await snapshotService.loadGeometry(ref)
        restored.dispose()
        geom.dispose()

        if (logTimings && (i + 1) % 10 === 0) {
          logger.log(`[UndoStressTest] ${i + 1}/${iterations}`, snapshotService.getTimingStats())
        }
      }

      const stats = snapshotService.getTimingStats()
      const coldBytes = await snapshotStore.getTotalBytes()
      logger.log('[UndoStressTest] Done.', {
        stats,
        coldStoreBytes: coldBytes,
        hotCacheSize: snapshotService._hot.size,
      })
    }
  }

  // Return a pure API object with functions and parameters
  const api = {
    // Undo/redo system
    undoManager,
    render,
    loadModel: undoLoadModel,
    loadModels: undoLoadModels,
    removeModel,
    setTransformMode,
    selectModel: meshManager.selectModel.bind(meshManager),
    selectModelByUuid,
    setSelectedModels,
    selectAllModels,
    getSelectedModelUuids,
    updatePosition: undoUpdatePosition,
    updateRotation: undoUpdateRotation,
    updateScale: undoUpdateScale,
    setToCenter: undoSetToCenter,
    setToBottom: undoSetToBottom,
    mirrorModel: undoMirrorModel,
    expandModel: undoExpandModel,
    setSceneColor,
    addShape: undoAddShape,
    scatterRandomObjects,
    // Collision detection (Problem 1)
    checkCollisions: collisionManager.checkAll.bind(collisionManager),
    checkCollisionsFor: collisionManager.checkFor.bind(collisionManager),
    setCollisionTolerance: (value) => {
      const v = collisionManager.setTolerance(value)
      collisionStore.tolerance = v
      return v
    },
    setModelCollisionTolerance: (uuid, value) => {
      const v = collisionManager.setModelTolerance(uuid, value)
      collisionStore.setModelGap(uuid, value == null ? null : v)
      return v
    },
    clearCollisions: collisionManager.clear.bind(collisionManager),
    getCollisionResults: () => collisionManager.results,
    // Building shell (procedural walls + columns)
    generateBuilding: regenerateBuilding,
    clearBuilding,
    // Model access methods
    getSelectedObject: () => selectionManager.selectedObject,
    exportSTL: meshManager.exportSTL.bind(meshManager),
    exportBinarySTL: meshManager.exportBinarySTL.bind(meshManager),
    exportAllModelsSTL: meshManager.exportAllModelsSTL.bind(meshManager),
    replaceModelGeometry: undoReplaceModelGeometryWithLabel,
    getModels: meshManager.getModels.bind(meshManager),
    arrangeModels: meshManager.arrangeModels.bind(meshManager),
    clip,
    changePrintBedSize,
    changeFrontMaterial: meshManager.changeFrontMaterial.bind(meshManager),
    getBuildVolumeBox,
    getOutOfBuildVolumeModels,
    hasOutOfBuildVolumeModels,
    setMatcapTexture: meshManager.setMatcapTexture.bind(meshManager),
    addModelsToScene,
    customizeAxisHelper: axisHelper.customize.bind(axisHelper),
    setLayOnFaceMode: faceSelectionManager.setLayOnFaceMode.bind(faceSelectionManager),
    toggleLayOnFaceMode: faceSelectionManager.toggleLayOnFaceMode.bind(faceSelectionManager),
    isLayOnFaceModeActive: faceSelectionManager.isLayOnFaceModeActive.bind(faceSelectionManager),
    setFaceOnTopMode: faceSelectionManager.setFaceOnTopMode.bind(faceSelectionManager),
    toggleFaceOnTopMode: faceSelectionManager.toggleFaceOnTopMode.bind(faceSelectionManager),
    isFaceOnTopModeActive: faceSelectionManager.isFaceOnTopModeActive.bind(faceSelectionManager),
    setFaceSelectionMode: faceSelectionManager.setFaceSelectionMode.bind(faceSelectionManager),
    toggleFaceSelectionMode: faceSelectionManager.toggleFaceSelectionMode.bind(faceSelectionManager),
    isFaceSelectionModeActive: faceSelectionManager.isFaceSelectionModeActive.bind(faceSelectionManager),
    subscribeFaceSelectionModeChange,
    // Scene access (for dev tools)
    getScene: () => scene,
    getCamera: () => camera,
    getDomElement: () => renderer.domElement,
    setOrbitEnabled: (enabled) => { cameraControl.enabled = enabled },
    setDragEnabled: (enabled) => {
      if (enabled) {
        dragControl.connect()
        selectionManager.enabled = true
      }
      else {
        dragControl.disconnect()
        transformControl.detach()
        selectionManager.enabled = false
      }
    },
    // Transaction API
    beginTransaction: undoManager.beginTransaction.bind(undoManager),
    commitTransaction: undoManager.commitTransaction.bind(undoManager),
    rollbackTransaction: undoManager.rollbackTransaction.bind(undoManager),
    exportModelAsStl: () => {
      const selected = selectionManager.selectedObject
      return selected ? meshManager.exportBinarySTL(selected, { filterChildren: true }) : null
    },
    // Scene & project management
    clearScene,
    _addModelDirect,
    getCameraState,
    restoreCamera,
  }

  // ProjectManager needs the API reference, so create it after building the api object
  api.projectManager = new ProjectManager(api)

  // Dev-only: expose the scene API for manual testing / e2e drivers.
  if (import.meta.env.DEV)
    window.__nexis = api

  return api
}
