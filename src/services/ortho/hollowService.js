/**
 * Backend hollow + extend bottom service for ortho auto-processing.
 */
import {
  createJob,
  extendBottom,
  generateHollow,
  getHollowStl,
  pollJobUntilComplete,
  updateJobConfig,
  uploadModel,
} from '@/axios/backendService'
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

/**
 * Generate a hollow mesh via the backend pipeline.
 * @param {object} params
 * @param {Blob} params.stlBlob - STL blob of the source model
 * @param {string} params.modelId - UUID of the source model
 * @param {object} params.hollowConfig - Hollow parameters for the backend
 * @param {object} [params.extendConfig] - Optional extend-bottom parameters
 * @returns {Promise<Mesh>} Three.js Mesh of the hollow result
 */
export async function generateHollowMesh({ stlBlob, modelId, hollowConfig, extendConfig }) {
  // Create job
  const jobResult = await createJob()
  const jobId = jobResult.data?.jobId || jobResult.jobId

  // Upload model
  const formData = new FormData()
  formData.append('file', stlBlob, `${modelId}.stl`)
  await uploadModel(jobId, formData)

  // Configure hollow params
  await updateJobConfig(jobId, {
    hollowing_enable: true,
    hollowing_min_thickness: hollowConfig.hollowing_min_thickness,
    hollowing_quality: hollowConfig.hollowing_quality,
    hollowing_closing_distance: hollowConfig.hollowing_closing_distance,
  })

  // Generate and poll
  await generateHollow(jobId)
  await pollJobUntilComplete(jobId, { timeout: 120000 })

  // Extend bottom vertices on the backend (modifies hollow.stl in-place)
  if (extendConfig) {
    await extendBottom(jobId, extendConfig.bottom_z_threshold, extendConfig.extension_distance)
  }

  // Download hollow STL (already extended if extendConfig was provided)
  const hollowBlob = await getHollowStl(jobId)
  const buffer = await hollowBlob.arrayBuffer()
  const geometry = new STLLoader().parse(buffer)
  geometry.computeVertexNormals()

  const material = new MeshStandardMaterial({
    color: 0x88AACC,
    roughness: 0.5,
    metalness: 0.1,
  })

  const mesh = new Mesh(geometry, material)
  mesh.name = 'hollowMesh'
  return { mesh, jobId }
}

/**
 * Align hollow mesh to the source object's world-space bounding box center.
 * The STL sent to backend had world transforms baked, so rotation/scale are
 * already in the geometry vertices. PrusaSlicer centers the model at origin
 * before hollowing, so we translate the hollow by the source's bbox center
 * to undo that centering (matching the backend's input_center alignment).
 * @param {Mesh} hollowMesh - The hollow mesh to align
 * @param {Object3D} sourceObject - The source object to derive center from
 */
export function alignHollowToSource(hollowMesh, sourceObject) {
  sourceObject.updateMatrixWorld(true)
  // Exclude children (e.g. back-face mesh) to match the STL sent to backend
  const children = [...sourceObject.children]
  sourceObject.children = []
  const center = new Box3().setFromObject(sourceObject).getCenter(new Vector3())
  sourceObject.children = children
  hollowMesh.position.copy(center)
}
