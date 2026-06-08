import { autoOrientSurgGuide } from '@/axios/backendService'
import { getOrientationModeKey } from '@/constants/orthoModes'
import { ORTHO_PREVIEW_COLORS } from '@/constants/theme.js'
import { AUTO_PROCESSING_ERROR_CODES, createAutoProcessingError } from '@/services/errors'
import { useGeneralStore } from '@/stores/state'
import { useBackendStore } from '@/stores/useBackendStore'
import { useParamsStore } from '@/stores/useParamsStore'
import { createDao } from '@/three/wasm/orient/dao.wrap'
import { logger } from '@/utils/logger'
import { BackSide, Box3, BoxGeometry, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Float32BufferAttribute, FrontSide, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, MeshMatcapMaterial, MeshPhysicalMaterial, MeshStandardMaterial, SphereGeometry, TextureLoader, TorusGeometry, Uint32BufferAttribute, Vector3 } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'
import { loadModelByFileType, processMesh } from '../loaders'
import { attachOutOfBoundsShader, createOobUniforms, updateBuildVolume } from '../outOfBoundsShader'
import { packRects } from '../rectPacker'
import { isSlicableChild } from './meshUtils'

const ORTHO_PREVIEW_TYPES = ['hollow', 'hex', 'drain', 'sidewall']
const FRONT_MATCAP_URL = 'https://cdn.jsdelivr.net/gh/nidorx/matcaps@master/1024/626262_9E9E9E_848484_262626.png'

// Multi-selection outline: a bounding-box frame drawn around each selected model.
const SELECTION_OUTLINE_COLOR = 0x3B82F6 // blue

// World up axis — used to yaw models about world Z when packing rotates them.
const WORLD_Z_AXIS = new Vector3(0, 0, 1)

function validateStlBuffer(buffer) {
  if (!(buffer instanceof ArrayBuffer))
    throw new TypeError('Expected STL data as an ArrayBuffer')

  if (buffer.byteLength < 6)
    throw new Error(`STL payload is too small (${buffer.byteLength} bytes)`)

  const prefix = new TextDecoder('ascii').decode(buffer.slice(0, Math.min(5, buffer.byteLength))).toLowerCase()
  if (prefix === 'solid')
    return

  if (buffer.byteLength < 84)
    throw new Error(`Binary STL payload is too small (${buffer.byteLength} bytes)`)

  const view = new DataView(buffer)
  const faceCount = view.getUint32(80, true)
  const expectedLength = 84 + (faceCount * 50)

  if (expectedLength !== buffer.byteLength) {
    throw new Error(
      `Invalid binary STL length: expected ${expectedLength} bytes from header, got ${buffer.byteLength} bytes`,
    )
  }
}

function buildOrientationBuffers(geometry) {
  const positionAttr = geometry?.attributes?.position
  if (!positionAttr) {
    throw new Error('Geometry missing position attribute')
  }

  const vertices = new Float32Array(positionAttr.array)
  const indexAttr = geometry.index

  if (indexAttr) {
    return {
      vertices,
      indices: new Uint32Array(indexAttr.array),
    }
  }

  const vertexCount = positionAttr.count
  if (vertexCount % 3 !== 0) {
    throw new Error('Non-indexed geometry does not contain complete triangles')
  }

  const indices = new Uint32Array(vertexCount)
  for (let i = 0; i < vertexCount; i++) {
    indices[i] = i
  }

  return { vertices, indices }
}

/**
 * Serialize orientation buffers (local-space vertices + triangle indices) into
 * a binary STL blob. Used to hand the model to the backend auto-orient endpoint
 * in the same local coordinate space the WASM module consumed. Face normals are
 * left zero — the backend recomputes them per face.
 */
function orientationBuffersToStlBlob(vertices, indices) {
  const triCount = Math.floor(indices.length / 3)
  const buffer = new ArrayBuffer(84 + triCount * 50)
  const dv = new DataView(buffer)
  dv.setUint32(80, triCount, true) // 80-byte header left zero

  let off = 84
  for (let t = 0; t < triCount; t++) {
    off += 12 // normal (0,0,0)
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k] * 3
      dv.setFloat32(off, vertices[vi], true); off += 4
      dv.setFloat32(off, vertices[vi + 1], true); off += 4
      dv.setFloat32(off, vertices[vi + 2], true); off += 4
    }
    off += 2 // attribute byte count
  }
  return new Blob([buffer], { type: 'application/octet-stream' })
}

/**
 * Build a (non-indexed) BufferGeometry containing only the given triangles,
 * for a debug-highlight overlay. Triangle index `t` uses the same
 * orientation-buffer triple as the STL sent to the backend:
 * vertices[indices[3t+k]].
 */
function buildFaceOverlayGeometry(vertices, indices, faceList) {
  const pos = new Float32Array(faceList.length * 9)
  for (let i = 0; i < faceList.length; i++) {
    const t = faceList[i]
    for (let k = 0; k < 3; k++) {
      const vi = indices[t * 3 + k] * 3
      pos[i * 9 + k * 3] = vertices[vi]
      pos[i * 9 + k * 3 + 1] = vertices[vi + 1]
      pos[i * 9 + k * 3 + 2] = vertices[vi + 2]
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3))
  return geometry
}

/**
 * Manager class responsible for handling meshes and 3D models
 * Encapsulates logic for loading, creating, transforming and manipulating 3D objects
 */
export class MeshManager {
  /**
   * Create a new MeshManager
   * @param {Scene} scene The Three.js scene
   * @param {object} modelStore The model store for state management
   * @param {object} dragControl The drag control instance
   * @param {SelectionManager} SelectionManager The selection manager instance
   * @param {Function} render The render function to trigger scene updates
   */
  constructor(scene, modelStore, dragControl, SelectionManager, render) {
    this.scene = scene
    this.modelStore = modelStore
    this.dragControl = dragControl
    this.SelectionManager = SelectionManager

    this.render = render
    this.models = []
    // Multi-selection outlines: uuid → BoxHelper drawn around each selected model
    this._selectionHelpers = new Map()
    this.faceSelectionManager = null
    this.hollowManager = null
    // Surgical-guide debug visualization: when true, the backend returns the
    // decision/candidate/concave faces + drill cylinders and they are overlaid
    // on the model. Default off (those arrays are large — saves bandwidth/time).
    this.surgGuideDebug = false
    this.orthoPreviewMeshes = {
      hollow: null,
      hex: null,
      drain: null,
      sidewall: null,
    }

    const frontMatcap = new TextureLoader().load(FRONT_MATCAP_URL)
    this.frontMaterial = new MeshMatcapMaterial({
      color: 0xFFFFFF,
      side: FrontSide,
      matcap: frontMatcap,
    })

    this.wireframeMaterial = new MeshPhysicalMaterial({
      color: 0xDDDDDD,
      side: FrontSide,
      wireframe: true,
    })

    this.backMaterial = new MeshMatcapMaterial({
      color: 0xB070B8,
      side: BackSide,
      matcap: frontMatcap,
    })

    // Attach out-of-bounds shader to both materials with shared uniforms
    this._oobUniforms = createOobUniforms()
    attachOutOfBoundsShader(this.frontMaterial, this._oobUniforms)
    attachOutOfBoundsShader(this.backMaterial, this._oobUniforms)
  }

  /**
   * Update build volume bounds for out-of-bounds visualization
   * @param {number} width - Build plate width (X)
   * @param {number} height - Build plate height (Y)
   * @param {number} depth - Build volume Z height
   */
  setBuildVolume(width, height, depth) {
    updateBuildVolume(this._oobUniforms, width, height, depth)
    this.render()
  }

  /**
   * Draw/refresh a corner-bracket selection outline around every selected model,
   * and remove outlines for models no longer selected. Each outline is a
   * scene-level LineSegments (excluded from slicing), not raycastable, and
   * depth-tested so the model occludes the brackets behind it.
   * @param {string[]} selectedUuids
   */
  updateSelectionHighlights(selectedUuids) {
    const set = new Set(selectedUuids || [])

    // Remove outlines for models no longer selected
    for (const uuid of [...this._selectionHelpers.keys()]) {
      if (!set.has(uuid))
        this._removeSelectionHelper(uuid)
    }

    // Add/refresh outlines for selected models
    for (const uuid of set) {
      const model = this.models.find(m => m.uuid === uuid)
      if (!model)
        continue
      let line = this._selectionHelpers.get(uuid)
      if (!line) {
        line = this._createCornerBox(model)
        line.name = `selectionOutline_${uuid}`
        line.raycast = () => {}
        line.userData.isDebugOverlay = true
        this.scene.add(line)
        this._selectionHelpers.set(uuid, line)
      }
      else {
        this._updateCornerBox(line, model)
      }
    }

    this.render()
  }

  /**
   * Re-fit all active selection outlines to their models (call after a selected
   * model is moved/transformed so the brackets follow).
   */
  refreshSelectionHighlights() {
    if (this._selectionHelpers.size === 0)
      return
    for (const [uuid, line] of this._selectionHelpers) {
      const model = this.models.find(m => m.uuid === uuid)
      if (model)
        this._updateCornerBox(line, model)
    }
    this.render()
  }

  /**
   * Create a corner-bracket outline LineSegments for a model.
   * @param {Object3D} model
   * @returns {LineSegments} the outline line segments
   */
  _createCornerBox(model) {
    const geometry = new BufferGeometry()
    // 8 corners × 3 brackets × 2 endpoints × 3 components = 144 floats
    geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(144), 3))
    // depthTest on so the model occludes the parts of the brackets behind it
    const material = new LineBasicMaterial({
      color: SELECTION_OUTLINE_COLOR,
      depthTest: true,
      transparent: false,
    })
    const line = new LineSegments(geometry, material)
    this._updateCornerBox(line, model)
    return line
  }

  /**
   * Recompute the corner brackets to fit the model's current world AABB.
   * At each of the 8 box corners, draws 3 short segments toward the adjacent
   * corners along x/y/z.
   * @param {LineSegments} line
   * @param {Object3D} model
   */
  _updateCornerBox(line, model) {
    const box = new Box3().setFromObject(model)
    if (box.isEmpty())
      return
    const { min, max } = box
    const dx = max.x - min.x
    const dy = max.y - min.y
    const dz = max.z - min.z
    const L = Math.max(dx, dy, dz) * 0.18 // bracket length, capped per-axis below
    const lx = Math.min(L, dx * 0.45)
    const ly = Math.min(L, dy * 0.45)
    const lz = Math.min(L, dz * 0.45)
    const xs = [min.x, max.x]
    const ys = [min.y, max.y]
    const zs = [min.z, max.z]

    const arr = line.geometry.attributes.position.array
    let i = 0
    const put = (x, y, z) => {
      arr[i] = x
      arr[i + 1] = y
      arr[i + 2] = z
      i += 3
    }
    const seg = (ax, ay, az, bx, by, bz) => {
      put(ax, ay, az)
      put(bx, by, bz)
    }
    for (let xi = 0; xi < 2; xi++) {
      for (let yi = 0; yi < 2; yi++) {
        for (let zi = 0; zi < 2; zi++) {
          const cx = xs[xi]
          const cy = ys[yi]
          const cz = zs[zi]
          const sx = xi === 0 ? 1 : -1
          const sy = yi === 0 ? 1 : -1
          const sz = zi === 0 ? 1 : -1
          seg(cx, cy, cz, cx + sx * lx, cy, cz) // along x
          seg(cx, cy, cz, cx, cy + sy * ly, cz) // along y
          seg(cx, cy, cz, cx, cy, cz + sz * lz) // along z
        }
      }
    }
    line.geometry.attributes.position.needsUpdate = true
    line.geometry.computeBoundingSphere()
  }

  /**
   * Remove and dispose the selection outline for a single model uuid.
   * @param {string} uuid
   */
  _removeSelectionHelper(uuid) {
    const line = this._selectionHelpers.get(uuid)
    if (!line)
      return
    this.scene.remove(line)
    line.geometry?.dispose()
    line.material?.dispose()
    this._selectionHelpers.delete(uuid)
  }

  setFaceSelectionManager(manager) {
    this.faceSelectionManager = manager
    this.models.forEach(model => this.faceSelectionManager.registerModel(model))
  }

  setHollowManager(manager) {
    this.hollowManager = manager
  }

  /**
   * Replace the matcap texture on the front material with cascading fallback
   * @param {string[]} urls URLs to try in order
   */
  setMatcapTexture(urls) {
    const apply = (texture) => {
      this.frontMaterial.matcap = texture
      this.frontMaterial.needsUpdate = true
      this.render()
    }
    const tryLoad = (i) => {
      if (i >= urls.length)
        return
      new TextureLoader().load(urls[i], apply, undefined, () => tryLoad(i + 1))
    }
    tryLoad(0)
  }

  /**
   * Get the appropriate material based on control mode
   * @param {string} viewMode The view mode from the store
   * @returns {Material} The material to use
   */
  _getMaterial(viewMode) {
    const materialMap = {
      normal: this.frontMaterial,
      wireframe: this.wireframeMaterial,
    }

    return materialMap[viewMode] || this.frontMaterial
  }

  async _getAutoOrientationRotation(vertices, indices) {
    const paramsStore = useParamsStore()
    const dentalModeRaw = paramsStore?._rawResinJson?.__dental_mode
    if (!dentalModeRaw) {
      throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientNoDentalMode)
    }
    const orthoMode = getOrientationModeKey(dentalModeRaw)

    // Surgical guide auto-orientation is computed on the backend (ported from
    // the WASM module). Other modes still run in the in-browser WASM module.
    if (orthoMode === 'SURGICAL_GUIDE') {
      const debug = this.surgGuideDebug === true
      let result
      try {
        const stlBlob = orientationBuffersToStlBlob(vertices, indices)
        result = await autoOrientSurgGuide(stlBlob, 2, debug)
      }
      catch (error) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed, {
          details: error?.message || String(error),
          cause: error,
          context: { orthoMode },
        })
      }
      const rotationRad = result?.rotation_rad
      if (!rotationRad || rotationRad.length !== 3) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed, {
          details: 'backend auto-orient did not return valid rotation angles',
          context: { orthoMode },
        })
      }
      // stash debug faces for the highlight overlay, only when debug is on
      // (the backend only returns the mesh info when debug is requested)
      this._lastSurgGuideDebug = debug
        ? {
            decisionFaces: result.decision_faces ?? [],
            stepFaces: result.step_faces ?? [],
            candidateFaces: result.candidate_faces ?? [],
            concaveFaces: result.concave_faces ?? [],
            cylinders: result.cylinders ?? [],
          }
        : null
      return rotationRad
    }

    const dao = await createDao()
    if (!dao.isOrientationMode(orthoMode)) {
      logger.warn(`auto processing for ${orthoMode} mode not implemented, default to ortho mode processing`)
    }

    const module = dao.ORIENTATION_MODES[orthoMode] ?? dao.ORIENTATION_MODES.ORTHODONTIC_MODEL
    let result
    try {
      result = dao.computeAutoOrientation({ vertices, indices }, module)
    }
    catch (error) {
      throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed, {
        details: error?.message || String(error),
        cause: error,
        context: { orthoMode },
      })
    }
    const rotationRad = dao.resolveRotationRad(result)

    if (!rotationRad || rotationRad.length !== 3) {
      throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientComputeFailed, {
        details: 'computeAutoOrientation did not return valid rotation angles',
        context: { orthoMode },
      })
    }

    return rotationRad
  }

  /**
   * Load a model from a file
   * @param {File} file The file to load
   * @returns {Promise} Promise for model loading
   */
  async loadModel(file, { autoPlace = true } = {}) {
    const state = useGeneralStore()
    const material = this._getMaterial(state.viewMode)

    const mesh = await loadModelByFileType(file, material, this.backMaterial)
    if (!mesh) {
      return Promise.reject(new Error('Failed to load model'))
    }
    // Position the model at the bottom
    this.setToBottom(mesh)

    // Add to scene and register
    this.scene.add(mesh)
    this._registerModel(mesh)
    // Place the newly loaded model in a free spot WITHOUT moving existing models
    // (mainstream behaviour). Skipped when autoPlace=false so a multi-file import
    // can pack the whole batch together via placeNewModelsBatch.
    if (autoPlace)
      this.placeModelInFreeSpot(mesh)
    this.render()
    return mesh
  }

  /**
   * Register a model to the necessary systems
   * @private
   * @param {Object3D} model The model to register
   */
  _registerModel(model) {
    this.models = [...this.models, model]
    this.modelStore.addModel(model, model.name)
    this.dragControl.objects.push(model)
    this.SelectionManager.addInteractiveObject(model)
    if (this.faceSelectionManager)
      this.faceSelectionManager.registerModel(model)
  }

  /**
   * Change the front material of the models
   * @param {object} params - The parameters for the new material
   * @param {boolean} params.wireframe - Whether to use wireframe material
   * @returns {MeshBasicMaterial|MeshMatcapMaterial} The material that was applied
   */
  changeFrontMaterial(params) {
    const targetMaterial = params.wireframe ? this.wireframeMaterial : this.frontMaterial

    // Helper function to update material for a single object
    const updateObjectMaterial = (object) => {
      if (object.isMesh) {
        // If the mesh has multiple materials (array), update only the front material
        if (Array.isArray(object.material)) {
          object.material[0] = targetMaterial
        }
        else {
          object.material = targetMaterial
        }
      }

      // Recursively update children if they exist
      if (object.children && object.children.length > 0) {
        object.children.forEach(child => updateObjectMaterial(child))
      }
    }

    // Update all models in the scene
    this.models.forEach((model) => {
      updateObjectMaterial(model)
    })

    // Trigger a re-render to reflect the changes
    this.render()

    return targetMaterial
  }

  /**
   * Compute and apply auto-orientation to the selected model
   * Uses the dental auto-orientation WASM module (mode inferred from resin selection)
   * @param {Object3D} [object] The object to auto-orient
   */
  async autoOrient(object = this.SelectionManager.selectedObject) {
    if (!object) {
      throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientNoSelection)
    }

    try {
      const { vertices, indices } = buildOrientationBuffers(object.geometry)

      const rotationRad = await this._getAutoOrientationRotation(vertices, indices)
      const [rx, ry, rz] = rotationRad
      this.updateRotation({ x: rx, y: ry, z: rz }, object, 'ZYX')
      // Drop to platform after rotation for better UX
      this.setToBottom(object)
      // Surgical-guide debug overlay: highlight the decision face + step faces
      const dbg = this._lastSurgGuideDebug
      this._lastSurgGuideDebug = null
      if (dbg && (dbg.decisionFaces.length || dbg.stepFaces.length || dbg.candidateFaces.length
        || dbg.concaveFaces.length || dbg.cylinders.length)) {
        this._highlightSurgGuideFaces(object, vertices, indices, dbg.decisionFaces, dbg.stepFaces, dbg.candidateFaces, dbg.concaveFaces, dbg.cylinders)
      }
      else {
        // debug off (or nothing to show) — remove any stale debug overlays
        this.clearSurgGuideDebugOverlay(object)
      }
      return rotationRad
    }
    catch (error) {
      if (error instanceof TypeError || error?.message?.includes('Geometry')) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientInvalidGeometry, {
          details: error?.message || String(error),
          cause: error,
        })
      }

      throw error
    }
  }

  /**
   * Debug visualization for surgical-guide auto-orient: overlay the chosen
   * drill end-face ("decision face", red) and the internal step faces used for
   * the entrance tiebreak ("step faces", blue) on the model, in distinct colors.
   *
   * Triangle indices index the orientation buffers (same triangle order as the
   * STL sent to the backend). Overlays are added as children of the model so
   * they follow its post-orient transform, are excluded from slicing/export via
   * `userData.isDebugOverlay`, and are not raycastable.
   *
   * @param {Object3D} object
   * @param {Float32Array} vertices - flat XYZ local-space positions
   * @param {Uint32Array} indices - triangle vertex indices
   * @param {number[]} decisionFaces - triangle indices of the decision face
   * @param {number[]} stepFaces - triangle indices of the step faces
   * @param {number[]} [candidateFaces] - triangle indices of other (non-chosen) drill candidates
   */
  _highlightSurgGuideFaces(object, vertices, indices, decisionFaces, stepFaces, candidateFaces = [], concaveFaces = [], cylinders = []) {
    this.clearSurgGuideDebugOverlay(object)

    // draw order low→high so the decision face stays on top of candidates/steps
    const overlays = [
      { name: 'surgGuide-concave', faces: concaveFaces, color: 0xFF8C00, order: 9996 }, // 凹面: 橙
      { name: 'surgGuide-candidate', faces: candidateFaces, color: 0xFFD60A, order: 9997 }, // 候選: 黃
      { name: 'surgGuide-step', faces: stepFaces, color: 0x2F7CFF, order: 9998 }, // 踏面: 藍
      { name: 'surgGuide-decision', faces: decisionFaces, color: 0xFF3B30, order: 9999 }, // 決選: 紅
    ]

    for (const { name, faces, color, order } of overlays) {
      if (!faces || faces.length === 0)
        continue
      const geometry = buildFaceOverlayGeometry(vertices, indices, faces)
      const material = new MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        depthTest: false,
        side: DoubleSide,
      })
      const mesh = new Mesh(geometry, material)
      mesh.name = name
      mesh.renderOrder = order
      mesh.raycast = () => {}
      mesh.userData.isDebugOverlay = true
      object.add(mesh)
    }

    // drill cylinders: one half-transparent cylinder enveloping each candidate
    // hole (axis = end-face normal, radius = hole radius), extending into the
    // model. Used to later exclude concave points inside the bore.
    if (cylinders && cylinders.length) {
      const group = new Group()
      group.name = 'surgGuide-cylinders'
      group.userData.isDebugOverlay = true
      for (const cyl of cylinders) {
        const ax = new Vector3(cyl.axis[0], cyl.axis[1], cyl.axis[2])
        if (ax.lengthSq() < 1e-9 || !(cyl.radius > 0))
          continue
        ax.normalize()
        // extend both ways along the axis to envelop the bore; overlaps are fine
        const length = cyl.length > 0 ? cyl.length : Math.max(cyl.radius * 10, 40)
        const geom = new CylinderGeometry(cyl.radius, cyl.radius, length, 28, 1, true)
        const mat = new MeshBasicMaterial({
          color: 0x00CFFF,
          transparent: true,
          opacity: 0.22,
          side: DoubleSide,
          depthWrite: false,
        })
        const cmesh = new Mesh(geom, mat)
        cmesh.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), ax)
        cmesh.position.set(cyl.center[0], cyl.center[1], cyl.center[2])
        cmesh.raycast = () => {}
        group.add(cmesh)
      }
      object.add(group)
    }

    this.render()
  }

  /**
   * Remove any surgical-guide debug overlays from the model.
   * @param {Object3D} [object]
   */
  clearSurgGuideDebugOverlay(object = this.SelectionManager.selectedObject) {
    if (!object)
      return
    let removed = false
    const names = ['surgGuide-decision', 'surgGuide-step', 'surgGuide-candidate', 'surgGuide-concave', 'surgGuide-cylinders']
    for (const name of names) {
      const existing = object.getObjectByName(name)
      if (existing) {
        // dispose self + children (cylinders group)
        existing.traverse((o) => {
          o.geometry?.dispose?.()
          if (Array.isArray(o.material))
            o.material.forEach(m => m?.dispose?.())
          else
            o.material?.dispose?.()
        })
        object.remove(existing)
        removed = true
      }
    }
    if (removed)
      this.render()
  }

  async autoProcess(object = this.SelectionManager.selectedObject) {
    if (!object) {
      throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoProcessNoSelection)
    }
    try {
      const { vertices, indices } = buildOrientationBuffers(object.geometry)

      const rotationRad = await this._getAutoOrientationRotation(vertices, indices)
      if (!this.hollowManager?.runOpenBottom) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoProcessHollowManagerUnavailable)
      }

      const { vertices: outVerts, indices: outInds } = await this.hollowManager.runOpenBottom(
        vertices,
        indices,
        rotationRad,
      )

      const offsetGeometry = new BufferGeometry()
      offsetGeometry.setAttribute('position', new Float32BufferAttribute(outVerts, 3))
      offsetGeometry.setIndex(new Uint32BufferAttribute(outInds, 1))
      offsetGeometry.computeVertexNormals()

      if (!this.hollowManager?.hollowGeometry) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoProcessHollowManagerUnavailable)
      }

      // const offsetMaterial = object.material.clone()
      // offsetMaterial.color.set(0xFF7C3F)
      // offsetMaterial.transparent = false
      // offsetMaterial.opacity = 1
      // offsetMaterial.needsUpdate = true

      // const existingOffset = object.getObjectByName('offsetMesh')
      // if (existingOffset) {
      //   object.remove(existingOffset)
      // }

      // const offsetMesh = new Mesh(offsetGeometry, offsetMaterial)
      // offsetMesh.name = 'offsetMesh'
      // object.add(offsetMesh)

      const hollowedGeometry = this.hollowManager.hollowGeometry(object.geometry, offsetGeometry)
      hollowedGeometry.computeVertexNormals()
      object.originalGeometry = object.originalGeometry || object.geometry.clone()
      object.geometry = hollowedGeometry
      object.material.needsUpdate = true
      object.userData.hollowed = true
      this.modelStore.syncSelectedModel()

      const [rx, ry, rz] = rotationRad
      this.updateRotation({ x: rx, y: ry, z: rz }, object, 'ZYX')
      this.setToBottom(object)
      this.render()
    }
    catch (error) {
      if (error instanceof TypeError || error?.message?.includes('Geometry')) {
        throw createAutoProcessingError(AUTO_PROCESSING_ERROR_CODES.autoOrientInvalidGeometry, {
          details: error?.message || String(error),
          cause: error,
        })
      }

      throw error
    }
  }

  /**
   * Add a primitive shape to the scene
   * @param {string} name The shape type (Box, Sphere, etc.)
   * @param {object} params Parameters for the shape
   * @returns {Object3D|null} The created mesh or null if invalid
   */
  addShape(name, params) {
    const geometry = this._createGeometry(name, params)

    if (!geometry)
      return null

    const mesh = processMesh(geometry, name, this.frontMaterial, this.backMaterial)

    // Attach parameters to mesh for UI reference using immutable approach
    mesh.userData = {
      ...mesh.userData,
      shapeParams: {
        type: name,
        params: { ...params },
      },
    }

    this.setToBottom(mesh)
    this.scene.add(mesh)
    this._registerModel(mesh)
    this.render()

    return mesh
  }

  /**
   * Create geometry based on type and parameters
   * @private
   * @param {string} name The shape type
   * @param {object} params Parameters for the shape
   * @returns {BufferGeometry|null} The created geometry or null if invalid
   */
  _createGeometry(name, params) {
    const geometryFactories = {
      Box: () => new BoxGeometry(
        params.width,
        params.height,
        params.depth,
        params.widthSegments,
        params.heightSegments,
        params.depthSegments,
      ),

      Capsule: () => new CapsuleGeometry(
        params.radius,
        params.length,
        params.capSegments,
        params.radialSegments,
      ),

      Cone: () => new ConeGeometry(
        params.radius,
        params.height,
        params.radialSegments,
        params.heightSegments,
        params.openEnded,
        params.thetaStart,
        params.thetaLength,
      ),

      Cylinder: () => new CylinderGeometry(
        params.radiusTop,
        params.radiusBottom,
        params.height,
        params.radialSegments,
        params.heightSegments,
        params.openEnded,
        params.thetaStart,
        params.thetaLength,
      ),

      Sphere: () => new SphereGeometry(
        params.radius,
        params.widthSegments,
        params.heightSegments,
        params.phiStart,
        params.phiLength,
        params.thetaStart,
        params.thetaLength,
      ),

      Torus: () => new TorusGeometry(
        params.radius,
        params.tube,
        params.radialSegments,
        params.tubularSegments,
        params.arc,
      ),
    }

    const factory = geometryFactories[name]
    if (!factory) {
      logger.warn(`Invalid geometry type: ${name}`)
      return null
    }

    return factory()
  }

  /**
   * Select a model by UUID
   * @param {string} uuid The UUID of the model to select
   */
  selectModel(uuid) {
    const model = this.models.find(model => model.uuid === uuid)
    if (model) {
      this.SelectionManager.selectObject(model)
    }
  }

  /**
   * Set model to bottom of scene
   * @param {Object3D} [object] The object to set to bottom
   */
  setToBottom(object = this.SelectionManager.selectedObject) {
    if (!object)
      return

    // Create a pure function to calculate new position
    const calculateBottomPosition = (obj) => {
      const box = new Box3().setFromObject(obj, true)
      return { z: obj.position.z - box.min.z }
    }

    // Apply the new position
    const newPosition = calculateBottomPosition(object)
    object.position.z = newPosition.z

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Measure each model's XY footprint (world AABB) + the offset of that
   * footprint's centre from the model's position, so footprints can be placed
   * precisely.
   * @param {Object3D[]} models
   * @returns {Array<{model: Object3D, w: number, d: number, offsetX: number, offsetY: number}>} footprint items
   */
  _measureFootprints(models) {
    return models.map((model) => {
      model.updateMatrixWorld(true)
      const box = new Box3().setFromObject(model)
      const center = box.getCenter(new Vector3())
      return {
        model,
        w: box.max.x - box.min.x,
        d: box.max.y - box.min.y,
        offsetX: center.x - model.position.x,
        offsetY: center.y - model.position.y,
      }
    })
  }

  /**
   * Shift a model so its current world XY footprint centre lands on (cx, cy).
   * Robust to any prior rotation (computes the live AABB centre).
   * @param {Object3D} model
   * @param {number} cx
   * @param {number} cy
   */
  _moveFootprintCenterTo(model, cx, cy) {
    model.updateMatrixWorld(true)
    const cur = new Box3().setFromObject(model).getCenter(new Vector3())
    model.position.x += cx - cur.x
    model.position.y += cy - cur.y
  }

  /**
   * Lay out footprint `items` on the plate via 2D rectangle packing (MaxRects),
   * treating `obstacles` (footprints of models to keep fixed) as pre-occupied.
   * Optionally centres the resulting cluster on the plate. Items that don't fit
   * are parked in a row to the right of the plate (OOB will flag them).
   * @param {Array<object>} items - footprint items (from _measureFootprints) to place
   * @param {object} [opts]
   * @param {Array<object>} [opts.obstacles] - footprint items to avoid (not moved)
   * @param {boolean} [opts.center] - centre the placed cluster on the plate
   * @param {number} [opts.gap] - gap between footprints in mm
   */
  _layoutModels(items, { obstacles = [], center = false, gap = 5 } = {}) {
    if (items.length === 0)
      return

    const { minX, maxX, minY, maxY } = this._plateBounds()
    const bin = { w: maxX - minX, h: maxY - minY }

    // Obstacles → bin-local space, inflated by gap so new items keep their distance
    const obs = obstacles.map((o) => {
      const fMinX = o.model.position.x + o.offsetX - o.w / 2
      const fMinY = o.model.position.y + o.offsetY - o.d / 2
      return { x: fMinX - minX - gap, y: fMinY - minY - gap, w: o.w + 2 * gap, h: o.d + 2 * gap }
    })

    // Pack item footprints padded by gap (spacing baked into the cell). Single-
    // pass MaxRects, big-first; allowRotate lets a model be turned 90° to fit.
    const packItems = items.map((it, i) => ({ id: i, w: it.w + gap, h: it.d + gap }))
    const { placements, unplaced } = packRects(bin, packItems, { obstacles: obs, sort: 'area', allowRotate: true })

    // Target footprint centre per placement. Footprint size = cell − gap, which
    // already reflects any 90° rotation the packer chose.
    const targets = placements.map(p => ({
      p,
      fw: p.w - gap,
      fh: p.h - gap,
      cx: minX + p.x + (p.w - gap) / 2,
      cy: minY + p.y + (p.h - gap) / 2,
    }))

    if (center && targets.length > 0) {
      let bMinX = Infinity
      let bMaxX = -Infinity
      let bMinY = Infinity
      let bMaxY = -Infinity
      for (const t of targets) {
        bMinX = Math.min(bMinX, t.cx - t.fw / 2)
        bMaxX = Math.max(bMaxX, t.cx + t.fw / 2)
        bMinY = Math.min(bMinY, t.cy - t.fh / 2)
        bMaxY = Math.max(bMaxY, t.cy + t.fh / 2)
      }
      const shiftX = (minX + maxX) / 2 - (bMinX + bMaxX) / 2
      const shiftY = (minY + maxY) / 2 - (bMinY + bMaxY) / 2
      for (const t of targets) {
        t.cx += shiftX
        t.cy += shiftY
      }
    }

    // Apply: rotate 90° about WORLD Z (pure yaw, robust to existing tilt) if the
    // packer turned it, then shift so the footprint centre lands on the target.
    for (const t of targets) {
      const model = items[t.p.id].model
      if (t.p.rotated)
        model.rotateOnWorldAxis(WORLD_Z_AXIS, Math.PI / 2)
      this._moveFootprintCenterTo(model, t.cx, t.cy)
      this.setToBottom(model)
    }

    // Overflow: park unfittable models in a row to the right of the plate
    let parkX = maxX + gap
    for (const id of unplaced) {
      const it = items[id]
      this._moveFootprintCenterTo(it.model, parkX + it.w / 2, 0)
      this.setToBottom(it.model)
      parkX += it.w + gap
    }

    this.refreshSelectionHighlights()
    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Lay out ALL models in a centred, compact, non-overlapping arrangement via
   * 2D rectangle packing. (Manual "arrange all" action.)
   * @param {object} [opts]
   * @param {number} [opts.gap] gap between models in mm
   */
  arrangeModels({ gap = 5 } = {}) {
    if (this.models.length === 0)
      return
    this._layoutModels(this._measureFootprints(this.models), { center: true, gap })
  }

  /** Plate XY bounds from the build-volume uniforms (with a sane fallback). */
  _plateBounds() {
    const min = this._oobUniforms?.uBuildMin?.value
    const max = this._oobUniforms?.uBuildMax?.value
    return {
      minX: min?.x ?? -67,
      maxX: max?.x ?? 67,
      minY: min?.y ?? -37.5,
      maxY: max?.y ?? 37.5,
    }
  }

  /** Centre a model's XY footprint on the plate origin. */
  _centerModelXY(model) {
    model.updateMatrixWorld(true)
    const box = new Box3().setFromObject(model)
    const center = box.getCenter(new Vector3())
    model.position.x += -center.x
    model.position.y += -center.y
  }

  /**
   * Place a newly loaded model in the first free spot on the plate WITHOUT
   * moving existing models. The first model is centred; subsequent models are
   * scanned top→bottom, left→right for a non-overlapping position; if the plate
   * is full the model is parked to the right of everything (OOB will warn).
   * @param {Object3D} newModel
   * @param {object} [opts]
   * @param {number} [opts.gap] minimum gap between footprints in mm
   */
  placeModelInFreeSpot(newModel, { gap = 5 } = {}) {
    const others = this.models.filter(m => m !== newModel)
    if (others.length === 0) {
      this._centerModelXY(newModel)
      this.setToBottom(newModel)
      return
    }

    newModel.updateMatrixWorld(true)
    const nbox = new Box3().setFromObject(newModel)
    const nw = nbox.max.x - nbox.min.x
    const nd = nbox.max.y - nbox.min.y
    const offsetX = (nbox.min.x + nbox.max.x) / 2 - newModel.position.x
    const offsetY = (nbox.min.y + nbox.max.y) / 2 - newModel.position.y

    const rects = others.map((m) => {
      m.updateMatrixWorld(true)
      const b = new Box3().setFromObject(m)
      return { minX: b.min.x, maxX: b.max.x, minY: b.min.y, maxY: b.max.y }
    })

    const { minX, maxX, minY, maxY } = this._plateBounds()
    const step = Math.max(gap, Math.min(nw, nd) * 0.5, 2)

    const fits = (cx, cy) => {
      // footprint must stay on the plate
      if (cx - nw / 2 < minX || cx + nw / 2 > maxX || cy - nd / 2 < minY || cy + nd / 2 > maxY)
        return false
      // and not overlap any existing footprint (padded by gap)
      const rMinX = cx - nw / 2 - gap
      const rMaxX = cx + nw / 2 + gap
      const rMinY = cy - nd / 2 - gap
      const rMaxY = cy + nd / 2 + gap
      return !rects.some(o => rMinX < o.maxX && rMaxX > o.minX && rMinY < o.maxY && rMaxY > o.minY)
    }

    let placed = false
    for (let cy = maxY - nd / 2; cy >= minY + nd / 2 && !placed; cy -= step) {
      for (let cx = minX + nw / 2; cx <= maxX - nw / 2 && !placed; cx += step) {
        if (fits(cx, cy)) {
          newModel.position.x = cx - offsetX
          newModel.position.y = cy - offsetY
          placed = true
        }
      }
    }

    if (!placed) {
      // Plate full → park to the right of everything (OOB highlight will flag it)
      const maxRight = Math.max(...rects.map(o => o.maxX))
      newModel.position.x = maxRight + gap + nw / 2 - offsetX
      newModel.position.y = -offsetY
    }

    this.setToBottom(newModel)
  }

  /**
   * Place a freshly-imported BATCH of models via 2D rectangle packing, treating
   * models already on the plate as fixed obstacles (never moved). An empty plate
   * centres the batch; otherwise it packs into the gaps around existing models.
   * @param {Object3D[]} newModels
   * @param {object} [opts]
   * @param {number} [opts.gap] gap between footprints in mm
   */
  placeNewModelsBatch(newModels, { gap = 5 } = {}) {
    if (!newModels || newModels.length === 0)
      return

    const newSet = new Set(newModels)
    const items = this._measureFootprints(newModels)
    const obstacles = this._measureFootprints(this.models.filter(m => !newSet.has(m)))

    this._layoutModels(items, { obstacles, center: obstacles.length === 0, gap })
  }

  /**
   * Center model in the scene (x,y)
   * @param {Object3D} [object] The object to center
   */
  setToCenter(object = this.SelectionManager.selectedObject) {
    if (!object)
      return

    const calculateCenteredPosition = (obj) => {
      const box = new Box3().setFromObject(obj, true)
      const center = box.getCenter(new Vector3())
      return {
        x: obj.position.x - center.x,
        y: obj.position.y - center.y,
      }
    }

    const newPosition = calculateCenteredPosition(object)
    object.position.x = newPosition.x
    object.position.y = newPosition.y

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Update model position
   * @param {Vector3} position The new position
   * @param {Object3D} [object] The object to update
   */
  updatePosition(position, object = this.SelectionManager.selectedObject) {
    if (!object)
      return

    const setPosition = (obj, pos) => {
      obj.position.set(pos.x, pos.y, pos.z)
      return obj
    }

    setPosition(object, position)

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Update model rotation
   * @param {Vector3} rotation The new rotation in radians
   * @param {Object3D} [object] The object to update
   */
  updateRotation(rotation, object = this.SelectionManager.selectedObject, order = 'XYZ') {
    if (!object)
      return

    const setRotation = (obj, rot) => {
      obj.rotation.set(rot.x, rot.y, rot.z, order)
      return obj
    }

    setRotation(object, rotation)

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Update model scale
   * @param {Vector3} scale The new scale
   * @param {boolean} lockRatio Whether to maintain aspect ratio
   * @param {Object3D} [object] The object to update
   */
  updateScale(scale, lockRatio, object = this.SelectionManager.selectedObject) {
    if (!object)
      return

    const calculateNewScale = (currentScale, targetScale, shouldLockRatio) => {
      if (!shouldLockRatio) {
        return { ...targetScale }
      }

      // Determine which axis was modified
      let multiplier = 1
      if (targetScale.x !== currentScale.x) {
        multiplier = targetScale.x / (currentScale.x || 1)
      }
      else if (targetScale.y !== currentScale.y) {
        multiplier = targetScale.y / (currentScale.y || 1)
      }
      else if (targetScale.z !== currentScale.z) {
        multiplier = targetScale.z / (currentScale.z || 1)
      }

      // Apply uniform scaling
      return {
        x: currentScale.x * multiplier,
        y: currentScale.y * multiplier,
        z: currentScale.z * multiplier,
      }
    }

    // Apply the new scale
    const newScale = calculateNewScale(object.scale, scale, lockRatio)
    object.scale.set(newScale.x, newScale.y, newScale.z)

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Expand model to fit the platform
   * @param {Object3D} [object] The object to expand
   */
  expandModel(object = this.SelectionManager.selectedObject) {
    if (!object)
      return

    const modelBox = new Box3().setFromObject(object, true)
    const modelSize = modelBox.getSize(new Vector3())
    const paramsStore = useParamsStore()
    const bedSize = paramsStore?.bedSize
    if (!bedSize || bedSize.length < 2) {
      logger.warn('Invalid bed size configuration')
      return
    }
    const planeSize = new Vector3(bedSize[0], bedSize[1], 0)

    // Calculate the ratio and scale the model
    const ratioSize = new Vector3().copy(planeSize).divide(modelSize)
    const maxScale = Math.min(ratioSize.x, ratioSize.y) || 1

    object.scale.multiplyScalar(maxScale)

    // Center and set to bottom
    this.setToCenter(object)
    this.setToBottom(object)

    this.render()
  }

  /**
   * Mirror a model along an axis
   * @param {'x'|'y'|'z'} axis The axis to mirror on
   * @param {boolean} [clone] Whether to clone the model
   * @param {Object3D} [object] The object to mirror
   * @returns {Object3D|null} The mirrored object or null if invalid
   */
  mirrorModel(axis, clone = false, object = this.SelectionManager.selectedObject) {
    if (!object)
      return null

    const objectToMirror = clone ? object.clone() : object

    if (clone) {
      this.scene.add(objectToMirror)
      this._registerModel(objectToMirror)
    }

    switch (axis) {
      case 'x':
        objectToMirror.scale.x *= -1
        break
      case 'y':
        objectToMirror.scale.y *= -1
        break
      case 'z':
        objectToMirror.scale.z *= -1
        break
      default:
        logger.warn('Invalid axis provided. Use "x", "y", or "z".')
        return null
    }

    this.render()
    return objectToMirror
  }

  /**
   * Remove a model from the scene and all managers WITHOUT disposing geometry.
   * Used by undo/redo lifecycle commands.
   * @param {Object3D} object The model to soft-remove
   */
  _softRemoveModel(object) {
    // Deselect first so TransformControls gets detached via the onDeselect callback
    if (this.SelectionManager.selectedObject === object) {
      this.SelectionManager.deselectObject()
    }
    // Drop any selection outline for this model
    this._removeSelectionHelper(object.uuid)

    // Hide the mesh tree so it's guaranteed invisible even if scene.remove somehow fails
    object.traverse((child) => {
      child.visible = false
    })

    const index = this.models.indexOf(object)
    if (index !== -1)
      this.models.splice(index, 1)

    this.scene.remove(object)

    const dragIndex = this.dragControl.objects.indexOf(object)
    if (dragIndex !== -1)
      this.dragControl.objects.splice(dragIndex, 1)

    const selIndex = this.SelectionManager.interactiveObjects.indexOf(object)
    if (selIndex !== -1)
      this.SelectionManager.interactiveObjects.splice(selIndex, 1)

    if (this.faceSelectionManager)
      this.faceSelectionManager.unregisterModel(object)

    this.modelStore.removeModel(object.uuid)
  }

  /**
   * Re-add a previously soft-removed model.
   * Used by undo/redo lifecycle commands.
   * @param {Object3D} object The model to soft-add
   */
  _softAddModel(object) {
    // Restore visibility (reversed by _softRemoveModel)
    object.traverse((child) => {
      child.visible = true
    })

    if (!this.models.includes(object)) {
      this.models = [...this.models, object]
    }
    if (!this.scene.children.includes(object)) {
      this.scene.add(object)
    }
    if (!this.dragControl.objects.includes(object)) {
      this.dragControl.objects.push(object)
    }
    if (!this.SelectionManager.interactiveObjects.includes(object)) {
      this.SelectionManager.addInteractiveObject(object)
    }
    if (this.faceSelectionManager) {
      this.faceSelectionManager.registerModel(object)
    }
    this.modelStore.addModel(object, object.name)
  }

  /**
   * Remove a model from the scene
   * @param {string} uuid The UUID of the model to remove
   * @returns {boolean} Whether the removal was successful
   */
  removeModel(uuid) {
    const index = this.models.findIndex(model => model.uuid === uuid)
    if (index === -1)
      return false

    const model = this.models[index]
    this._removeSelectionHelper(uuid)
    if (this.faceSelectionManager)
      this.faceSelectionManager.unregisterModel(model)
    this.scene.remove(model)
    this.models.splice(index, 1)

    // Remove from drag control
    const dragIndex = this.dragControl.objects.indexOf(model)
    if (dragIndex !== -1) {
      this.dragControl.objects.splice(dragIndex, 1)
    }

    // Remove from selection manager
    const selectionIndex = this.SelectionManager.interactiveObjects.indexOf(model)
    if (selectionIndex !== -1) {
      this.SelectionManager.interactiveObjects.splice(selectionIndex, 1)
    }

    this.modelStore.removeModel(uuid)
    this.render()
    return true
  }

  /**
   * Get all models managed by this manager
   * @returns {Array<Object3D>} Array of managed models
   */
  getModels() {
    return [...this.models]
  }

  _clearOrthoPreviewMesh(type) {
    const mesh = this.orthoPreviewMeshes[type]
    if (!mesh)
      return

    this.scene.remove(mesh)
    mesh.geometry?.dispose?.()
    if (Array.isArray(mesh.material)) {
      mesh.material.forEach(material => material?.dispose?.())
    }
    else {
      mesh.material?.dispose?.()
    }
    this.orthoPreviewMeshes[type] = null
  }

  _createOrthoPreviewMesh(type, sourceMesh) {
    if (!sourceMesh?.geometry)
      return null

    const material = new MeshStandardMaterial({
      color: ORTHO_PREVIEW_COLORS[type] ?? 0xFFFFFF,
      roughness: 0.35,
      metalness: 0.05,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
    })

    const previewMesh = new Mesh(sourceMesh.geometry.clone(), material)
    previewMesh.name = `orthoPreview-${type}`
    previewMesh.position.copy(sourceMesh.position)
    previewMesh.quaternion.copy(sourceMesh.quaternion)
    previewMesh.scale.copy(sourceMesh.scale)
    previewMesh.visible = false
    previewMesh.userData = {
      ...previewMesh.userData,
      isOrthoPreview: true,
      orthoPreviewType: type,
    }
    return previewMesh
  }

  setOrthoPreviewMeshes(meshes = {}) {
    for (const type of ORTHO_PREVIEW_TYPES) {
      if (!(type in meshes))
        continue

      this._clearOrthoPreviewMesh(type)
      const sourceMesh = meshes[type]
      if (!sourceMesh)
        continue

      const previewMesh = this._createOrthoPreviewMesh(type, sourceMesh)
      if (!previewMesh)
        continue

      this.orthoPreviewMeshes[type] = previewMesh
      this.scene.add(previewMesh)
    }

    this.render()
  }

  setOrthoPreviewVisible(type, visible) {
    const mesh = this.orthoPreviewMeshes[type]
    if (!mesh)
      return

    mesh.visible = Boolean(visible)
    this.render()
  }

  clearOrthoPreviewMeshes() {
    for (const type of ORTHO_PREVIEW_TYPES) {
      this._clearOrthoPreviewMesh(type)
    }
    this.render()
  }

  /**
   * Updates a specific parameter of a shape geometry
   * @param {string} uuid - The UUID of the model to update
   * @param {string} paramName - The name of the parameter to update
   * @param {any} value - The new value for the parameter
   */
  updateShapeParam(uuid, paramName, value) {
    const model = this.getModelByUuid(uuid)
    if (!model || !model.userData.shapeParams)
      return

    // Update the parameter in the userData
    model.userData.shapeParams.params[paramName] = value

    // Recreate the geometry with updated parameters
    this.updateShapeGeometry(model)

    this.render()
  }

  /**
   * Resets all shape parameters to their default values
   * @param {string} uuid - The UUID of the model to reset
   */
  resetShapeParams(uuid) {
    const model = this.getModelByUuid(uuid)
    if (!model || !model.userData.shapeParams)
      return

    const shapeType = model.userData.shapeParams.type
    // Get the default parameters for this shape type from your shapes definition
    const defaultParams = this.getDefaultShapeParams(shapeType)

    if (defaultParams) {
      model.userData.shapeParams.params = { ...defaultParams }
      this.updateShapeGeometry(model)

      // Update the store
      if (this.modelStore.selectedModel.uuid.value === uuid) {
        this.modelStore.selectedModel.shapeParams.params = { ...defaultParams }
      }

      this.render()
    }
  }

  /**
   * Updates the geometry of a shape based on its parameters
   * @param {Object3D} _model - The model to update
   */
  updateShapeGeometry(_model) {
    // const { type, params } = model.userData.shapeParams

    // // Create new geometry with updated parameters
    // const geometry = new THREE[type](...Object.values(params))

    // // Replace the old geometry
    // model.geometry.dispose() // Clean up old geometry
    // model.geometry = geometry

    // // Update dimensions if needed
    // this.updateModelDimensions(model)

    // // Sync with model store if this is the selected model
    // if (this.modelStore.selectedModel.uuid.value === model.uuid) {
    //   this.modelStore.syncSelectedModel()
    // }
  }

  /**
   * Gets the default parameters for a given shape type
   * @param {string} shapeType - The type of shape
   * @returns {object} The default parameters for this shape
   */
  getDefaultShapeParams(shapeType) {
    // This would need to reference your shapes definition from CreateShape.vue
    // You might need to make that available globally or pass it to the mesh manager
    const shapeDefinitions = {
      BoxGeometry: {
        width: 32,
        height: 32,
        depth: 32,
        widthSegments: 1,
        heightSegments: 1,
        depthSegments: 1,
      },
      SphereGeometry: {
        radius: 16,
        widthSegments: 32,
        heightSegments: 16,
        phiStart: 0,
        phiLength: Math.PI * 2,
        thetaStart: 0,
        thetaLength: Math.PI,
      },
      // Add other shape definitions as needed
    }

    return shapeDefinitions[shapeType]
  }

  /**
   * Exports a model as an STL file
   * @param {Object3D} model - The model to export
   * @returns {Blob} The exported STL file as a Blob
   */
  exportSTL(model) {
    const exporter = new STLExporter()
    const stlString = exporter.parse(model)
    const blob = new Blob([stlString], { type: 'application/octet-stream' })
    return blob
  }

  /**
   * Exports a model as a binary STL Blob (world-space baked).
   * @param {Object3D} model - The model to export
   * @param {object} [options]
   * @param {boolean} [options.filterChildren] - When true, export only the root mesh unless childFilter is provided
   * @param {(child: Object3D) => boolean} [options.childFilter] - Optional predicate to keep specific children during export
   * @returns {Blob} Binary STL blob
   */
  exportBinarySTL(model, options = {}) {
    const {
      filterChildren = false,
      childFilter = null,
    } = options

    const exporter = new STLExporter()
    const shouldFilterChildren = filterChildren || typeof childFilter === 'function'

    if (!shouldFilterChildren) {
      const buffer = exporter.parse(model, { binary: true })
      return new Blob([buffer], { type: 'application/octet-stream' })
    }

    // STLExporter recurses model.children to collect geometry, so we temporarily
    // replace the children array with a filtered copy rather than cloning the whole
    // scene graph. The original array is always restored in the finally block.
    const originalChildren = [...model.children]
    model.children = typeof childFilter === 'function'
      ? originalChildren.filter(childFilter)
      : []

    try {
      model.updateMatrixWorld(true)
      const buffer = exporter.parse(model, { binary: true })
      return new Blob([buffer], { type: 'application/octet-stream' })
    }
    finally {
      model.children = originalChildren
    }
  }

  /**
   * Export all models as a single binary STL, filtering each model's children
   * to only include slicable meshes (excludes back-face, offsetMesh, ortho preview).
   * @param {Object3D[]} models - Array of scene models
   * @returns {Blob} Combined binary STL blob
   */
  exportAllModelsSTL(models) {
    const exporter = new STLExporter()

    // Save original children and parents, then filter
    const saved = []
    for (const model of models) {
      saved.push({
        model,
        parent: model.parent,
        children: [...model.children],
      })
      model.children = model.children.filter(isSlicableChild)
    }

    // Temporarily reparent all models into a group for single export
    const group = new Group()
    for (const model of models) {
      group.add(model)
    }
    group.updateMatrixWorld(true)

    let buffer
    try {
      buffer = exporter.parse(group, { binary: true })
    }
    finally {
      // Restore all models' parents and children
      for (const { model, parent, children } of saved) {
        model.children = children
        if (parent) {
          parent.add(model)
        }
        else {
          group.remove(model)
        }
      }
    }

    return new Blob([buffer], { type: 'application/octet-stream' })
  }

  /**
   * Replace a model's geometry with the geometry from an STL blob.
   * Converts from world space to local space.
   * @param {Object3D} model - The model to update
   * @param {Blob} stlBlob - The STL blob containing new geometry
   */
  async replaceModelGeometry(model, stlBlob) {
    const buffer = await stlBlob.arrayBuffer()
    validateStlBuffer(buffer)
    const newGeometry = new STLLoader().parse(buffer)

    // Convert world -> local space
    model.updateMatrixWorld(true)
    const inverseWorld = model.matrixWorld.clone().invert()
    newGeometry.applyMatrix4(inverseWorld)

    // Recompute normals after space conversion
    newGeometry.computeVertexNormals()
    newGeometry.computeBoundingBox()
    newGeometry.computeBoundingSphere()

    model.geometry.dispose()
    model.geometry = newGeometry

    // Update back-face child mesh to use the same new geometry
    for (const child of model.children) {
      if (child.isMesh && child.material?.side === BackSide) {
        child.geometry = newGeometry
      }
    }

    model.userData.orthoProcessed = true

    // Invalidate cached slicing/support jobs so next slice re-uploads the processed geometry
    useBackendStore().clearJobsForModel(model.uuid)

    this.modelStore.syncSelectedModel()
    this.render()
  }

  /**
   * Create a new geometry without draw range limitations
   * @param {BufferGeometry} geometry
   * @returns {BufferGeometry} The new geometry
   */
  fixDrawRange(geometry) {
    const newGeometry = new BufferGeometry()
    const indices = geometry.index.array
    const positions = geometry.attributes.position.array
    const normals = geometry.attributes.normal.array

    // Only copy the vertices that are actually used (within drawRange)
    const start = geometry.drawRange.start
    const count = geometry.drawRange.count
    const usedPositions = positions.slice(start * 3, (start + count) * 3)
    const usedNormals = normals.slice(start * 3, (start + count) * 3)

    newGeometry.setAttribute('position', new Float32BufferAttribute(usedPositions, 3))
    newGeometry.setAttribute('normal', new Float32BufferAttribute(usedNormals, 3))
    if (indices) {
      const usedIndices = indices.slice(start, start + count)
      newGeometry.setIndex(new Uint32BufferAttribute(usedIndices, 1))
    }
    return newGeometry
  }
}
