/**
 * Ortho auto-processing orchestrator.
 * Runs the full pipeline: hollow -> hex grid -> drain holes -> boolean operations.
 */
import { slicer } from '@/axios/axios'
import {
  createJob,
  generateDrainHolesBackend,
  generateHexGridBackend,
  getBooleanStl,
  getDrainHolesStl,
  getHexGridStl,
  getHollowAlignedStl,
  getOrthoResultStl,
  orthoProcess,
  performBoolean,
  pollJobUntilComplete,
  uploadModel,
} from '@/axios/backendService'
import { BackendError, OrthoProcessingError } from '@/services/errors'
import { logger } from '@/utils/logger'
import { Box3 } from 'three'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'
import { debugExportBlob, debugExportMesh } from './debugExport'
import { generateSideWallDrains } from './drillService'
import { alignHollowToSource, generateHollowMesh } from './hollowService'

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function extractJobId(payload) {
  return payload?.data?.jobId
    || payload?.data?.job_id
    || payload?.jobId
    || payload?.job_id
    || null
}

function extractResultPath(payload) {
  return payload?.data?.resultPath
    || payload?.data?.result_path
    || payload?.resultPath
    || payload?.result_path
    || null
}

function toArrayBuffer(binaryData) {
  if (binaryData instanceof ArrayBuffer)
    return binaryData.slice(0)

  if (ArrayBuffer.isView(binaryData)) {
    return binaryData.buffer.slice(
      binaryData.byteOffset,
      binaryData.byteOffset + binaryData.byteLength,
    )
  }

  throw new TypeError('Expected ArrayBuffer or typed array-like binary data')
}

function detectCorruptBinaryStl(buffer) {
  if (!(buffer instanceof ArrayBuffer))
    return false

  if (buffer.byteLength < 84)
    return true

  const view = new DataView(buffer)
  const faceCount = view.getUint32(80, true)
  const expectedLength = 84 + (faceCount * 50)

  return expectedLength !== buffer.byteLength
}

async function waitForBooleanStl(jobId, options = {}) {
  const {
    interval = 500,
    timeout = 120000,
  } = options

  const startTime = Date.now()

  for (;;) {
    try {
      return await getBooleanStl(jobId)
    }
    catch (err) {
      const status = err?.response?.status
      if ((status === 400 || status === 404) && Date.now() - startTime <= timeout) {
        await sleep(interval)
        continue
      }
      throw err
    }
  }
}

async function waitForBooleanStlAtPath(resultPath, options = {}) {
  const {
    interval = 500,
    timeout = 120000,
  } = options

  const startTime = Date.now()

  for (;;) {
    try {
      const response = await slicer.get(resultPath, { responseType: 'blob' })
      return response.data
    }
    catch (err) {
      const status = err?.response?.status
      if ((status === 400 || status === 404) && Date.now() - startTime <= timeout) {
        await sleep(interval)
        continue
      }
      throw err
    }
  }
}

/**
 * Flip all triangle normals and swap vertex winding in a binary STL buffer.
 * @param {ArrayBuffer|ArrayBufferView} binaryData - Binary STL data
 * @returns {ArrayBuffer} Flipped STL data
 */
function flipSTLFaces(binaryData) {
  const data = new DataView(toArrayBuffer(binaryData))
  const numTriangles = data.getUint32(80, true)
  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50
    // Negate normal
    for (let j = 0; j < 3; j++) {
      const nOff = offset + j * 4
      data.setFloat32(nOff, -data.getFloat32(nOff, true), true)
    }
    // Swap vertex 2 and vertex 3
    const v2 = new Float32Array(3)
    const v3 = new Float32Array(3)
    for (let j = 0; j < 3; j++) {
      v2[j] = data.getFloat32(offset + 24 + j * 4, true)
      v3[j] = data.getFloat32(offset + 36 + j * 4, true)
    }
    for (let j = 0; j < 3; j++) {
      data.setFloat32(offset + 24 + j * 4, v3[j], true)
      data.setFloat32(offset + 36 + j * 4, v2[j], true)
    }
  }
  return data.buffer
}

/**
 * Export a mesh to a binary STL Blob, baking world transform.
 * @param {Object3D} mesh - Mesh to export
 * @returns {Blob} Binary STL blob
 */
function meshToBlob(mesh) {
  mesh.updateMatrixWorld(true)
  const exporter = new STLExporter()
  const buffer = exporter.parse(mesh, { binary: true })
  return new Blob([buffer], { type: 'application/octet-stream' })
}

/**
 * Run a boolean operation via backend and return the result blob.
 * @param {Blob} blobA - First mesh blob
 * @param {Blob} blobB - Second mesh blob
 * @param {string} operation - Boolean operation type
 * @returns {Promise<Blob>} Result STL blob
 */
export async function runBoolean(blobA, blobB, operation, parentJobId = '') {
  const result = await performBoolean(blobA, blobB, operation, parentJobId)
  const resultPath = extractResultPath(result)
  const jobId = extractJobId(result)

  if (resultPath) {
    const blob = await waitForBooleanStlAtPath(resultPath, { timeout: 120000 })
    return { blob, jobId }
  }

  if (!jobId) {
    throw new OrthoProcessingError('Boolean response missing resultPath/jobId', { result })
  }

  const blob = await waitForBooleanStl(jobId, { timeout: 120000 })
  return { blob, jobId }
}

/**
 * Run the full ortho auto-processing pipeline.
 * @param {object} params
 * @param {Object3D} params.selectedObject - The selected model to process
 * @param {Blob} params.stlBlob - STL blob of the selected model
 * @param {string} params.modelId - UUID of the model
 * @param {object} params.orthoParams - Ortho processing parameters
 * @param {boolean} params.debug - Enable debug STL export
 * @param {Function} params.onPreviewMeshes - Callback with intermediate preview meshes
 * @param {Function} params.onProgress - Progress callback (step, message)
 * @returns {Promise<Blob>} Final processed STL blob
 */
export async function runOrthoAutoProcessing({
  selectedObject,
  stlBlob,
  modelId,
  orthoParams,
  debug = false,
  onProgress = () => {},
  onPreviewMeshes = () => {},
}) {
  const emitPreviewMeshes = (meshes) => {
    try {
      onPreviewMeshes(meshes)
    }
    catch (err) {
      logger.warn('Failed to emit ortho preview meshes:', err)
    }
  }

  try {
    // ========== Step 1: Backend Hollow + Extend Bottom ==========
    onProgress(1, 'Generating hollow mesh...')

    const { mesh: hollowMesh, jobId } = await generateHollowMesh({
      stlBlob,
      modelId,
      hollowConfig: {
        hollowing_min_thickness: orthoParams.hollowing_min_thickness,
        hollowing_quality: orthoParams.hollowing_quality,
        hollowing_closing_distance: orthoParams.hollowing_closing_distance,
      },
      extendConfig: {
        bottom_z_threshold: orthoParams.bottom_z_threshold,
        extension_distance: orthoParams.extension_distance,
      },
    })

    alignHollowToSource(hollowMesh, selectedObject)
    hollowMesh.updateMatrixWorld(true)

    const bbox = new Box3().setFromObject(selectedObject)

    emitPreviewMeshes({ hollow: hollowMesh })

    debugExportMesh(debug, hollowMesh, 'step1_extendedHollow')

    // ========== Step 2: Generate Meshes + Boolean Union(hex, drain) ==========
    onProgress(2, 'Generating infill and drain meshes...')

    const hexGridResult = await generateHexGridBackend(jobId, {
      hex_cell_radius: orthoParams.hex_cell_radius,
      wall_thickness: orthoParams.hex_wall_thickness,
      grid_count: orthoParams.hex_grid_count,
      pyramid_height: orthoParams.hex_pyramid_height,
      fallback_height: 20,
      bottom_z: bbox.min.z,
    })

    if (!hexGridResult?.faces) {
      throw new OrthoProcessingError('Hex grid generation failed - no cells built')
    }

    const hexBlob = await getHexGridStl(jobId)

    await generateDrainHolesBackend(jobId, {
      hex_cell_radius: orthoParams.hex_cell_radius,
      wall_thickness: orthoParams.hex_wall_thickness,
      grid_count: orthoParams.hex_grid_count,
      drain_radius: orthoParams.drain_hole_radius,
      bottom_z: bbox.min.z,
    })
    const drainBlob = await getDrainHolesStl(jobId)

    const sideWallDrainMesh = generateSideWallDrains({
      outerShell: selectedObject,
      innerShell: hollowMesh,
      drainRadius: orthoParams.drain_hole_radius,
      hollowWallThickness: orthoParams.hollowing_min_thickness,
      bottomZ: 0,
      hexCellRadius: orthoParams.hex_cell_radius,
      hexWallThickness: orthoParams.hex_wall_thickness,
    })

    emitPreviewMeshes({
      hollow: hollowMesh,
      sidewall: sideWallDrainMesh,
    })

    debugExportBlob(debug, hexBlob, 'step2a_hexGrid')
    debugExportBlob(debug, drainBlob, 'step2b_drainHoles')
    debugExportMesh(debug, sideWallDrainMesh, 'step2c_sideWallDrains')

    let step2ResultBlob

    if (drainBlob) {
      ;({ blob: step2ResultBlob } = await runBoolean(hexBlob, drainBlob, 'union', jobId))
    }
    else {
      step2ResultBlob = hexBlob
    }

    debugExportBlob(debug, step2ResultBlob, 'step2_hexDrainUnion')

    // ========== Step 3: Flip Hollow + Intersection ==========
    onProgress(3, 'Computing intersection with hollow...')

    // Use the backend's aligned hollow (same as hollow_for_raycasting)
    const hollowAlignedBlob = await getHollowAlignedStl(jobId)
    const hollowBuffer = await hollowAlignedBlob.arrayBuffer()
    const flippedHollowBuffer = flipSTLFaces(hollowBuffer)
    const flippedHollowBlob = new Blob([flippedHollowBuffer], { type: 'application/octet-stream' })

    debugExportBlob(debug, flippedHollowBlob, 'step3a_flippedHollow')

    const { blob: step3ResultBlob } = await runBoolean(flippedHollowBlob, step2ResultBlob, 'intersection', jobId)

    debugExportBlob(debug, step3ResultBlob, 'step3_intersection')

    // ========== Step 4: Union Wall Drains ==========
    onProgress(4, 'Adding side wall drains...')

    let step4ResultBlob
    if (sideWallDrainMesh) {
      const wallDrainBlob = meshToBlob(sideWallDrainMesh)
      ;({ blob: step4ResultBlob } = await runBoolean(wallDrainBlob, step3ResultBlob, 'union', jobId))
    }
    else {
      step4ResultBlob = step3ResultBlob
    }

    debugExportBlob(debug, step4ResultBlob, 'step4_wallDrainUnion')

    // ========== Step 5: Final Difference ==========
    onProgress(5, 'Computing final difference...')

    // Export only the mesh's own geometry (no children) to avoid
    // the back-face child mesh doubling the face count.
    selectedObject.updateMatrixWorld(true)
    const children = [...selectedObject.children]
    selectedObject.children = []
    const selectedBlob = meshToBlob(selectedObject)
    selectedObject.children = children

    const { blob: finalResultBlob, jobId: lastBooleanJobId } = await runBoolean(selectedBlob, step4ResultBlob, 'difference', jobId)

    debugExportBlob(debug, finalResultBlob, 'step5_finalResult')

    onProgress(6, 'Complete')

    return { blob: finalResultBlob, lastBooleanJobId }
  }
  catch (err) {
    if (err instanceof BackendError)
      throw err
    if (err instanceof OrthoProcessingError)
      throw err
    // Surface backend 500 detail (e.g. boolean failure in packaged app)
    const detail = err.response?.data?.detail
    const message = (typeof detail === 'string' ? detail : null) || err.message || 'Ortho processing failed'
    throw new OrthoProcessingError(message, { cause: err })
  }
}

/**
 * Run the consolidated ortho auto-processing pipeline.
 *
 * Uploads the model once, runs all 10 steps server-side, then downloads
 * the final result. Reduces HTTP round-trips from 15+ to 4 and transfer
 * from ~43MB to ~6MB.
 *
 * @param {object} params
 * @param {Blob} params.stlBlob - STL blob of the selected model
 * @param {object} params.orthoParams - Ortho processing parameters
 * @param {Function} params.onProgress - Progress callback (step, message)
 * @returns {Promise<{blob: Blob, jobId: string}>} Final processed STL blob and job ID
 */
export async function runOrthoAutoProcessingConsolidated({
  stlBlob,
  orthoParams,
  onProgress = () => {},
}) {
  try {
    // Step 1: Create job
    onProgress(1, 'Creating job...')
    const createResult = await createJob({})
    const jobId = createResult?.data?.jobId
    if (!jobId) {
      throw new OrthoProcessingError('Failed to create job')
    }

    // Step 2: Upload model
    onProgress(1, 'Uploading model...')
    const formData = new FormData()
    formData.append('file', stlBlob, 'model.stl')
    await uploadModel(jobId, formData)

    // Step 3: Start consolidated pipeline
    onProgress(1, 'Starting ortho pipeline...')
    await orthoProcess(jobId, {
      hollowing_min_thickness: orthoParams.hollowing_min_thickness,
      hollowing_quality: orthoParams.hollowing_quality,
      hollowing_closing_distance: orthoParams.hollowing_closing_distance,
      bottom_z_threshold: orthoParams.bottom_z_threshold,
      extension_distance: orthoParams.extension_distance,
      hex_cell_radius: orthoParams.hex_cell_radius,
      hex_wall_thickness: orthoParams.hex_wall_thickness,
      hex_grid_count: orthoParams.hex_grid_count,
      hex_pyramid_height: orthoParams.hex_pyramid_height,
      drain_hole_radius: orthoParams.drain_hole_radius,
    })

    // Step 4: Wait for the backend to finish writing ortho_result.stl.
    await pollJobUntilComplete(jobId, {
      interval: 500,
      timeout: 120000,
      onProgress: (status, data) => {
        const progress = data?.orthoProgress
        if (progress) {
          onProgress(progress.step, progress.description)
        }
        else {
          onProgress(1, `Processing (${status})...`)
        }
      },
    })

    // Step 5: Download result
    onProgress(10, 'Downloading result...')
    const blob = await getOrthoResultStl(jobId)
    const buffer = await blob.arrayBuffer()

    if (detectCorruptBinaryStl(buffer)) {
      throw new OrthoProcessingError(
        `Backend returned an invalid ortho STL (${buffer.byteLength} bytes). The file was likely incomplete or malformed.`,
      )
    }

    onProgress(10, 'Complete')
    return { blob: new Blob([buffer], { type: 'application/octet-stream' }), jobId }
  }
  catch (err) {
    if (err instanceof BackendError)
      throw err
    if (err instanceof OrthoProcessingError)
      throw err
    const detail = err.response?.data?.detail
    const message = (typeof detail === 'string' ? detail : null) || err.message || 'Ortho processing failed'
    throw new OrthoProcessingError(message, { cause: err })
  }
}
