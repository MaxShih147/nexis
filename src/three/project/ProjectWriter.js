import { useGeneralStore } from '@/stores/state'
import JSZip from 'jszip'
import { buildContentTypes, buildModelXml, buildRels } from './xmlBuilder'

/**
 * Serialize the current scene state into a 3MF ZIP blob.
 *
 * nexis: 3D-printing fields (support / drill / hollow / ortho / slicing params)
 * are no longer serialized — only model geometry, transforms, camera and UI state.
 *
 * @param {object} opts
 * @param {Function} opts.getModels        () => Object3D[]
 * @param {object}   opts.camera           { position, target } — THREE camera + orbit target
 * @returns {Promise<Blob>} The 3MF file as a Blob
 */
export async function writeProject({ getModels, camera }) {
  const generalStore = useGeneralStore()

  const models = getModels()
  if (models.length === 0) {
    throw new Error('No models in scene to save')
  }

  // -- Build 3MF model XML objects --
  const xmlObjects = []
  const projectModels = []
  let objectId = 1

  for (const model of models) {
    model.updateMatrixWorld(true)

    const modelObjectId = objectId++
    xmlObjects.push({
      objectId: modelObjectId,
      name: model.name || 'model',
      geometry: model.geometry,
      matrix: model.matrixWorld,
    })

    projectModels.push({
      objectId: modelObjectId,
      name: model.name || 'model',
      uuid: model.uuid,
      userData: {
        shapeParams: model.userData.shapeParams || null,
      },
      position: { x: model.position.x, y: model.position.y, z: model.position.z },
      rotation: { x: model.rotation.x, y: model.rotation.y, z: model.rotation.z, order: model.rotation.order },
      scale: { x: model.scale.x, y: model.scale.y, z: model.scale.z },
    })
  }

  // -- Build ds-project.json --
  const projectJson = {
    version: 1,
    createdAt: new Date().toISOString(),
    models: projectModels,
    camera: camera
      ? {
          position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
          target: camera.target ? { x: camera.target.x, y: camera.target.y, z: camera.target.z } : null,
        }
      : null,
    ui: {
      controlMode: generalStore.controlMode,
      viewMode: generalStore.viewMode,
    },
  }

  // -- Assemble ZIP --
  const zip = new JSZip()
  zip.file('[Content_Types].xml', buildContentTypes())
  zip.folder('_rels').file('.rels', buildRels())
  zip.folder('3D').file('3dmodel.model', buildModelXml(xmlObjects))
  zip.folder('Metadata').file('ds-project.json', JSON.stringify(projectJson, null, 2))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}
