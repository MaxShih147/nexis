import { useGeneralStore } from '@/stores/state'
import JSZip from 'jszip'
import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Uint32BufferAttribute } from 'three'
import { processMesh } from '../loaders/index'

/**
 * Parse the 3D/3dmodel.model XML and extract mesh objects.
 *
 * @param {string} xmlString
 * @returns {Array<{objectId: number, name: string, geometry: BufferGeometry, transform: Matrix4|null}>} Parsed mesh objects keyed by their 3MF object metadata.
 */
function parse3dModel(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')

  // Collect objects from <resources>
  const objectElements = doc.getElementsByTagName('object')
  const objectsById = new Map()

  for (const objEl of objectElements) {
    const objectId = Number.parseInt(objEl.getAttribute('id'), 10)
    const name = objEl.getAttribute('name') || 'model'

    const meshEl = objEl.getElementsByTagName('mesh')[0]
    if (!meshEl)
      continue

    // Parse vertices
    const vertexEls = meshEl.getElementsByTagName('vertex')
    const positions = new Float32Array(vertexEls.length * 3)
    for (let i = 0; i < vertexEls.length; i++) {
      positions[i * 3] = Number.parseFloat(vertexEls[i].getAttribute('x'))
      positions[i * 3 + 1] = Number.parseFloat(vertexEls[i].getAttribute('y'))
      positions[i * 3 + 2] = Number.parseFloat(vertexEls[i].getAttribute('z'))
    }

    // Parse triangles
    const triEls = meshEl.getElementsByTagName('triangle')
    const indices = new Uint32Array(triEls.length * 3)
    for (let i = 0; i < triEls.length; i++) {
      indices[i * 3] = Number.parseInt(triEls[i].getAttribute('v1'), 10)
      indices[i * 3 + 1] = Number.parseInt(triEls[i].getAttribute('v2'), 10)
      indices[i * 3 + 2] = Number.parseInt(triEls[i].getAttribute('v3'), 10)
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(new Uint32BufferAttribute(indices, 1))
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()

    objectsById.set(objectId, { objectId, name, geometry, transform: null })
  }

  // Parse build items for transforms
  const itemEls = doc.getElementsByTagName('item')
  for (const itemEl of itemEls) {
    const objectId = Number.parseInt(itemEl.getAttribute('objectid'), 10)
    const transformStr = itemEl.getAttribute('transform')
    const obj = objectsById.get(objectId)
    if (!obj)
      continue

    if (transformStr) {
      obj.transform = parseTransform(transformStr)
    }
  }

  return [...objectsById.values()]
}

/**
 * Parse a 3MF transform string into a Three.js Matrix4.
 * 3MF format: "m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32"
 *
 * @param {string} str
 * @returns {Matrix4} A Three.js transform matrix built from the 3MF transform string.
 */
function parseTransform(str) {
  const v = str.trim().split(/\s+/).map(Number)
  if (v.length !== 12)
    return new Matrix4()

  // 3MF → column-major Matrix4
  // 3MF: m00 m01 m02  m10 m11 m12  m20 m21 m22  m30 m31 m32
  //       v0  v1  v2   v3  v4  v5   v6  v7  v8   v9 v10 v11
  const m = new Matrix4()
  m.set(
    v[0],
    v[3],
    v[6],
    v[9],
    v[1],
    v[4],
    v[7],
    v[10],
    v[2],
    v[5],
    v[8],
    v[11],
    0,
    0,
    0,
    1,
  )
  return m
}

/**
 * Load a 3MF file and restore the scene.
 *
 * @param {File|Blob} file       The .3mf file
 * @param {object}    sceneApi   The scene coordinator API object
 * @returns {Promise<{models: object[], projectData: object|null}>} Restored model entries and any saved project metadata from the archive.
 */
export async function readProject(file, sceneApi) {
  const arrayBuffer = await file.arrayBuffer()
  const zip = await JSZip.loadAsync(arrayBuffer)

  // -- Parse 3D model XML --
  const modelFile = zip.file('3D/3dmodel.model')
  if (!modelFile) {
    throw new Error('Invalid 3MF: missing 3D/3dmodel.model')
  }
  const xmlString = await modelFile.async('string')
  const objects = parse3dModel(xmlString)

  if (objects.length === 0) {
    throw new Error('No mesh objects found in 3MF file')
  }

  // -- Parse ds-project.json (optional — external 3MF files won't have it) --
  let projectData = null
  const metadataFile = zip.file('Metadata/ds-project.json')
  if (metadataFile) {
    try {
      const jsonStr = await metadataFile.async('string')
      projectData = JSON.parse(jsonStr)
    }
    catch {
      // Ignore malformed JSON — treat as external 3MF
    }
  }

  // -- Clear current scene --
  sceneApi.clearScene()

  // Build a mapping from objectId → project model data (if available)
  const modelDataById = new Map()
  if (projectData?.models) {
    for (const m of projectData.models) {
      modelDataById.set(m.objectId, m)
    }
  }

  // -- Reconstruct meshes --
  const loadedModels = []
  for (const obj of objects) {
    const modelData = modelDataById.get(obj.objectId)

    // Apply BVH for raycasting (if available)
    if (typeof obj.geometry.computeBoundsTree === 'function') {
      obj.geometry.computeBoundsTree()
    }

    const mesh = processMesh(obj.geometry, modelData?.name ?? obj.name)

    // Restore transform: prefer exact values from ds-project.json over matrix decompose
    if (modelData?.position && modelData?.rotation && modelData?.scale) {
      // Use saved Euler rotation directly (avoids quaternion decompose ambiguity)
      const { position: p, rotation: r, scale: s } = modelData
      mesh.position.set(p.x, p.y, p.z)
      mesh.rotation.copy(new Euler(r.x, r.y, r.z, r.order || 'XYZ'))
      mesh.scale.set(s.x, s.y, s.z)
    }
    else if (obj.transform) {
      // External 3MF (no ds-project.json): decompose the 3MF transform matrix
      obj.transform.decompose(mesh.position, mesh.quaternion, mesh.scale)
    }

    // Restore DS-Online userData if available
    if (modelData) {
      if (modelData.userData) {
        mesh.userData = { ...mesh.userData, ...modelData.userData }
      }
    }

    // Register into scene via the coordinator's internal method
    sceneApi._addModelDirect(mesh)
    loadedModels.push(mesh)
  }

  // -- Restore app state from ds-project.json --
  if (projectData) {
    _restoreAppState(projectData, sceneApi)
  }

  // Clear undo history — can't undo past a project load
  sceneApi.undoManager.clear()

  return { models: loadedModels, projectData }
}

/**
 * Restore application state from project data.
 * @param {object} data   ds-project.json content
 * @param {object} sceneApi
 */
function _restoreAppState(data, sceneApi) {
  const generalStore = useGeneralStore()

  // Camera
  if (data.camera && sceneApi.restoreCamera) {
    sceneApi.restoreCamera(data.camera)
  }

  // UI state
  if (data.ui) {
    if (data.ui.viewMode)
      generalStore.viewMode = data.ui.viewMode
  }

  // Reset control mode to drag (safe default after load)
  generalStore.controlMode = 'drag'
}
