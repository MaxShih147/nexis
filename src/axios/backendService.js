import { JobFailedError, JobTimeoutError } from '@/services/errors'
import { slicer } from './axios'

// V2 API path helper
const v2 = path => `/api/v2${path}`

// Helpers
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function requireJobId(jobId) {
  if (!jobId)
    throw new Error('jobId is required')
}

function requireConfig(config) {
  if (!config || typeof config !== 'object')
    throw new TypeError('config must be an object')
}

function requireFormData(formData) {
  if (!(formData instanceof FormData))
    throw new TypeError('formData must be a FormData instance')
}

function requireLayerIndex(layerIndex) {
  if (typeof layerIndex !== 'number' || layerIndex < 0)
    throw new TypeError('layerIndex must be a non-negative number')
}

function isNil(value) {
  return value === null || value === undefined
}

function normalizeSliceJobData(data) {
  if (!data || typeof data !== 'object')
    return data

  const normalized = { ...data }

  if (isNil(normalized.layerCount) && !isNil(data.layer_count))
    normalized.layerCount = data.layer_count
  if (isNil(normalized.layer_count) && !isNil(data.layerCount))
    normalized.layer_count = data.layerCount

  if (isNil(normalized.estimatedPrintTime) && !isNil(data.estimated_print_time))
    normalized.estimatedPrintTime = data.estimated_print_time
  if (isNil(normalized.estimated_print_time) && !isNil(data.estimatedPrintTime))
    normalized.estimated_print_time = data.estimatedPrintTime

  if (isNil(normalized.resinVolumeMl) && !isNil(data.resin_volume_ml))
    normalized.resinVolumeMl = data.resin_volume_ml
  if (isNil(normalized.resinVolumeMl) && !isNil(data.volume))
    normalized.resinVolumeMl = data.volume
  if (isNil(normalized.resin_volume_ml) && !isNil(data.resinVolumeMl))
    normalized.resin_volume_ml = data.resinVolumeMl
  if (isNil(normalized.volume) && !isNil(data.resinVolumeMl))
    normalized.volume = data.resinVolumeMl

  if (isNil(normalized.hasSupportMesh) && !isNil(data.has_support_mesh))
    normalized.hasSupportMesh = data.has_support_mesh
  if (isNil(normalized.hasHollowMesh) && !isNil(data.has_hollow_mesh))
    normalized.hasHollowMesh = data.has_hollow_mesh
  if (isNil(normalized.hasCutMesh) && !isNil(data.has_cut_mesh))
    normalized.hasCutMesh = data.has_cut_mesh

  if (isNil(normalized.has_support_mesh) && !isNil(data.hasSupportMesh))
    normalized.has_support_mesh = data.hasSupportMesh
  if (isNil(normalized.has_hollow_mesh) && !isNil(data.hasHollowMesh))
    normalized.has_hollow_mesh = data.hasHollowMesh
  if (isNil(normalized.has_cut_mesh) && !isNil(data.hasCutMesh))
    normalized.has_cut_mesh = data.hasCutMesh

  return normalized
}

/**
 * Health check - check if backend server is available
 * @returns {Promise<object>} Server info
 */
export async function healthCheck() {
  const response = await slicer.get('/api/health')
  return response.data
}

/**
 * Create a new slicing job
 * @param {object} przConfig - Full Mechado config (Machine/Print/Advanced)
 * @param {number[]|undefined} [center] - Optional [x, y] bounding-box center offset
 * @returns {Promise<object>} Job info with jobId
 */
export async function createJob(przConfig = undefined, center = undefined) {
  if (przConfig !== undefined && (typeof przConfig !== 'object' || Array.isArray(przConfig)))
    throw new TypeError('createJob: przConfig must be a non-null object')
  const body = {}
  if (przConfig !== undefined)
    body.prz_config = przConfig
  if (center !== undefined)
    body.center = center
  const response = await slicer.post(v2('/slices'), body)
  return response.data
}

/**
 * Update job configuration
 * @param {string} jobId - Job ID
 * @param {object} config - Configuration to update (snake_case slicing config)
 * @param {boolean} isAppend - Whether to append or replace config
 * @param {object} [przConfig] - Optional full Mechado config (Title Case "Print.*") for PRZ print-time sync
 * @returns {Promise<object>} Updated job info
 */
export async function updateJobConfig(jobId, config, isAppend = false, przConfig = undefined) {
  requireJobId(jobId)
  requireConfig(config)
  const body = { config, isAppend }
  if (przConfig !== undefined)
    body.prz_config = przConfig
  const response = await slicer.put(v2(`/slices/${jobId}/config`), body)
  return response.data
}

/**
 * Upload model to a job
 * @param {string} jobId - Job ID
 * @param {FormData} formData - FormData containing the STL file
 * @returns {Promise<object>} Upload result
 */
export async function uploadModel(jobId, formData) {
  requireJobId(jobId)
  requireFormData(formData)
  const response = await slicer.post(v2(`/slices/${jobId}/upload`), formData)
  return response.data
}

/**
 * Reference an existing job's output file as the model (skip re-upload)
 * @param {string} jobId - Target job ID
 * @param {string} sourceJobId - Source job ID that has the file
 * @param {string} sourceFile - Filename in source job output (default: boolean.stl)
 * @returns {Promise<object>} Result
 */
export async function useModelFromJob(jobId, sourceJobId, sourceFile = 'ortho_result.stl') {
  requireJobId(jobId)
  requireJobId(sourceJobId)
  const response = await slicer.post(v2(`/slices/${jobId}/use-model-from/${sourceJobId}`), null, {
    params: { source_file: sourceFile },
  })
  return response.data
}

/**
 * Generate supports for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Generation result
 */
export async function generateSupports(jobId) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/generate-supports`))
  return response.data
}

/**
 * Generate hollow for a job (orthodontic mode)
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Generation result
 */
export async function generateHollow(jobId) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/generate-hollow`))
  return response.data
}

/**
 * Extend bottom vertices of hollow mesh on the backend.
 * Modifies hollow.stl in-place on the server.
 * @param {string} jobId - Job ID
 * @param {number} bottomZThreshold - Z threshold above mesh min to select vertices
 * @param {number} extensionDistance - Distance to extend vertices downward
 * @returns {Promise<object>} Result data (e.g. { vertices_moved })
 */
export async function extendBottom(jobId, bottomZThreshold, extensionDistance) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/extend-bottom`), {
    bottom_z_threshold: bottomZThreshold,
    extension_distance: extensionDistance,
  })
  return response.data.data
}

/**
 * Execute slicing for a job
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Slicing result with layer count, print time, volume
 */
export async function executeSlicing(jobId) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/execute`))
  return response.data
}

/**
 * Get support STL file
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} STL file blob
 */
export async function getSupportStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/support.stl`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get hollow STL file
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} STL file blob
 */
export async function getHollowStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/hollow.stl`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get aligned hollow STL file (translated to match input model coordinates)
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} STL file blob
 */
export async function getHollowAlignedStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/hollow_aligned.stl`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get a sliced layer image
 * @param {string} jobId - Job ID
 * @param {number} layerIndex - Layer index (0-based)
 * @returns {Promise<Blob>} PNG image blob
 */
export async function getLayerImage(jobId, layerIndex) {
  requireJobId(jobId)
  requireLayerIndex(layerIndex)
  const response = await slicer.get(`/api/jobs/${jobId}/layers/${layerIndex}.png`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get all layer PNGs as a single ZIP file
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} ZIP file blob
 */
export async function getLayersZip(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/layers.zip`, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Get layer metadata for DS-Online compatibility
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Uchars metadata
 */
export async function getUChars(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(v2(`/slices/${jobId}/uchars`))
  return response.data
}

/**
 * Get slicing gcode metadata
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Gcode metadata
 */
export async function getGcodeMetadata(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(v2(`/slices/${jobId}/gcode`))
  const payload = response.data
  if (!payload || typeof payload !== 'object')
    return payload

  return {
    ...payload,
    data: normalizeSliceJobData(payload.data),
  }
}

// ========== PRZ / Preview ==========

/**
 * Get preview ZIP (downscaled WebP layer images)
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} ZIP file blob containing WebP images
 */
export async function getPreviewZip(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(v2(`/slices/${jobId}/preview.zip`), {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Download PRZ file generated on the backend.
 * Config is read from the job's prz_config.json saved at execute time — no config needed here.
 * @param {string} jobId - Job ID
 * @param {object|null} [previews] - Optional preview images for PRZ thumbnails
 * @param {{width:number,height:number,rgb:Uint8Array}} [previews.small] - Small preview
 * @param {{width:number,height:number,rgb:Uint8Array}} [previews.large] - Large preview
 * @returns {Promise<Blob>} PRZ file blob
 */
export async function downloadPrz(jobId, previews = null) {
  requireJobId(jobId)
  const body = {}
  const small = encodePreviewField(previews?.small)
  if (small)
    body.preview_small = small
  const large = encodePreviewField(previews?.large)
  if (large)
    body.preview_large = large
  const response = await slicer.post(v2(`/slices/${jobId}/download.prz`), body, {
    responseType: 'blob',
  })
  return response.data
}

function encodePreviewField(preview) {
  if (!preview)
    return null
  const { width, height, rgb } = preview
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0)
    return null
  if (!(rgb instanceof Uint8Array) || rgb.length !== width * height * 3)
    return null
  return { width, height, rgb_b64: uint8ArrayToBase64(rgb) }
}

function uint8ArrayToBase64(bytes) {
  // Chunked btoa to avoid call-stack limits on large buffers
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize)
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
  return btoa(binary)
}

// ========== Drain Holes ==========

/**
 * Generate drain hole cylinders on the backend
 * @param {string} jobId - Job ID (reuses existing hollow job)
 * @param {object} params - Drain hole parameters
 * @param {number} params.hex_cell_radius - Hex cell radius (mm)
 * @param {number} params.wall_thickness - Wall thickness (mm)
 * @param {number} params.grid_count - Number of hex cells per row
 * @param {number} params.drain_radius - Drain hole cylinder radius (mm)
 * @param {number} params.bottom_z - Z position of the print bed
 * @returns {Promise<object>} Result data with resultPath
 */
export async function generateDrainHolesBackend(jobId, params) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/generate-drain-holes`), params)
  return response.data.data
}

/**
 * Get drain holes STL file
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} STL file blob
 */
export async function getDrainHolesStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/drain_holes.stl`, {
    responseType: 'blob',
  })
  return response.data
}

// ========== Hex Grid ==========

/**
 * Generate hex grid infill mesh on the backend
 * @param {string} jobId - Job ID (reuses existing hollow job)
 * @param {object} params - Hex grid parameters
 * @param {number} params.hex_cell_radius - Hex cell radius (mm)
 * @param {number} params.wall_thickness - Wall thickness (mm)
 * @param {number} params.grid_count - Number of hex cells per row
 * @param {number} params.pyramid_height - Pyramid dome height (mm)
 * @param {number} params.fallback_height - Fallback prism height (mm)
 * @param {number} params.bottom_z - Z position of the print bed
 * @returns {Promise<object>} Result data with resultPath
 */
export async function generateHexGridBackend(jobId, params) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/generate-hex-grid`), params)
  return response.data.data
}

/**
 * Get hex grid STL file
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} STL file blob
 */
export async function getHexGridStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/hex_grid.stl`, {
    responseType: 'blob',
  })
  return response.data
}

// ========== Boolean Operations ==========

/**
 * Perform a boolean operation on two meshes
 * @param {Blob} meshABlob - First mesh STL blob
 * @param {Blob} meshBBlob - Second mesh STL blob
 * @param {'difference'|'union'|'intersection'} operation - Boolean operation type
 * @returns {Promise<object>} Job info
 */
export async function performBoolean(meshABlob, meshBBlob, operation = 'difference', parentJobId = '') {
  const formData = new FormData()
  formData.append('mesh_a', meshABlob, 'mesh_a.stl')
  formData.append('mesh_b', meshBBlob, 'mesh_b.stl')
  formData.append('operation', operation)
  if (parentJobId)
    formData.append('parent_job_id', parentJobId)
  const response = await slicer.post(v2('/boolean'), formData)
  return response.data
}

/**
 * Get boolean operation result STL
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} Result STL blob
 */
export async function getBooleanStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/boolean.stl`, {
    responseType: 'blob',
  })
  return response.data
}

// ========== Consolidated Ortho Processing ==========

/**
 * Start consolidated ortho processing pipeline on the backend.
 * All 10 steps run server-side as a single background task.
 * @param {string} jobId - Job ID (must have model uploaded)
 * @param {object} params - Pipeline parameters
 * @param {number} params.hollowing_min_thickness
 * @param {number} params.hollowing_quality
 * @param {number} params.hollowing_closing_distance
 * @param {number} params.bottom_z_threshold
 * @param {number} params.extension_distance
 * @param {number} params.hex_cell_radius
 * @param {number} params.hex_wall_thickness
 * @param {number} params.hex_grid_count
 * @param {number} params.hex_pyramid_height
 * @param {number} params.drain_hole_radius
 * @returns {Promise<object>} { success, data: { jobId } }
 */
export async function orthoProcess(jobId, params) {
  requireJobId(jobId)
  const response = await slicer.post(v2(`/slices/${jobId}/ortho-process`), params)
  return response.data.data
}

/**
 * Get the consolidated ortho processing result STL
 * @param {string} jobId - Job ID
 * @returns {Promise<Blob>} Result STL blob
 */
export async function getOrthoResultStl(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(`/api/jobs/${jobId}/ortho_result.stl`, {
    responseType: 'blob',
  })
  return response.data
}

// ========== Boundary Detection ==========

/**
 * Detect boundary loops on a mesh
 * @param {Blob} stlBlob - Binary STL blob
 * @returns {Promise<object>} Boundary detection result
 */
export async function detectBoundary(stlBlob) {
  const formData = new FormData()
  formData.append('file', stlBlob, 'model.stl')
  const response = await slicer.post(v2('/detect-boundary'), formData)
  return response.data
}

/**
 * Smooth boundary loop points (Taubin smoothing)
 * @param {Array} loops - Array of { points: [[x,y,z], ...] }
 * @param {object} params - { iterations, lambda, mu }
 * @returns {Promise<object>} Smoothed boundary result
 */
export async function smoothBoundary(loops, params = {}) {
  const response = await slicer.post(v2('/smooth-boundary'), {
    loops,
    ...params,
  })
  return response.data
}

/**
 * Apply smoothed boundary to mesh — returns modified STL blob
 * @param {Blob} stlBlob - Original STL blob
 * @param {Array} originalPoints - Original boundary points
 * @param {Array} smoothedPoints - Smoothed boundary points
 * @param {number} falloffRings - Number of falloff rings
 * @returns {Promise<Blob>} Modified STL blob
 */
export async function applyBoundary(stlBlob, originalPoints, smoothedPoints, falloffRings = 3) {
  const formData = new FormData()
  formData.append('file', stlBlob, 'model.stl')
  formData.append('data', JSON.stringify({
    original_points: originalPoints,
    smoothed_points: smoothedPoints,
    falloff_rings: falloffRings,
  }))
  const response = await slicer.post(v2('/apply-boundary'), formData, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Generate base mesh: auto-orient + wall + bottom
 * @param {Blob} stlBlob - STL blob (with smoothed boundary applied)
 * @param {object} [options]
 * @param {number} [options.elevation] - Initial elevation (mm) baked into geometry
 * @param {boolean} [options.chamfer] - Whether to bevel the generated base edge.
 * @param {boolean} [options.skipOrient] - Whether to skip backend auto-orientation.
 * @returns {Promise<Blob>} Combined STL blob
 */
export async function generateBase(stlBlob, { elevation = 0.1, chamfer = false, skipOrient = false } = {}) {
  const formData = new FormData()
  formData.append('file', stlBlob, 'model.stl')
  formData.append('elevation', String(elevation))
  if (chamfer)
    formData.append('chamfer', 'true')
  if (skipOrient)
    formData.append('skip_orient', 'true')
  const response = await slicer.post(v2('/generate-base'), formData, {
    responseType: 'blob',
  })
  return response.data
}

/**
 * Compute dental auto-orientation on the backend.
 * @param {Blob} stlBlob - local-space STL blob
 * @param {number} [mode] - orientation mode (2 = surgical guide)
 * @returns {Promise<{rotation_rad: number[], decision_faces: number[], step_faces: number[]}>}
 *   rotation_rad: [rx, ry, rz] radians (apply with Euler order 'ZYX');
 *   decision_faces / step_faces: triangle indices for debug highlighting.
 */
export async function autoOrientSurgGuide(stlBlob, mode = 2, debug = false) {
  const formData = new FormData()
  formData.append('file', stlBlob, 'model.stl')
  formData.append('mode', String(mode))
  if (debug)
    formData.append('debug', 'true')
  const response = await slicer.post(v2('/auto-orient'), formData)
  return response.data?.data ?? {}
}

// ========== Job Status Polling ==========

/**
 * Get job status
 * @param {string} jobId - Job ID
 * @returns {Promise<object>} Job status info
 */
export async function getJobStatus(jobId) {
  requireJobId(jobId)
  const response = await slicer.get(v2(`/slices/${jobId}`))
  const payload = response.data
  if (!payload || typeof payload !== 'object')
    return payload

  return {
    ...payload,
    data: normalizeSliceJobData(payload.data),
  }
}

/**
 * Poll job until completed or failed
 * @param {string} jobId - Job ID
 * @param {object} options - Polling options
 * @param {number} options.interval - Polling interval in ms (default: 500)
 * @param {number} options.timeout - Max wait time in ms (default: 60000)
 * @param {Function} options.onProgress - Callback for progress updates
 * @returns {Promise<object>} Final job status
 * @throws {JobTimeoutError} If timeout exceeded
 * @throws {JobFailedError} If job failed
 */
export async function pollJobUntilComplete(jobId, options = {}) {
  const {
    interval = 500,
    timeout = 60000,
    onProgress = null,
  } = options

  const startTime = Date.now()

  for (;;) {
    const result = await getJobStatus(jobId)
    const status = result.data?.status

    if (onProgress) {
      onProgress(status, result.data)
    }

    if (status === 'completed') {
      return result
    }

    if (status === 'failed') {
      throw new JobFailedError(undefined, result.data)
    }

    if (Date.now() - startTime > timeout) {
      throw new JobTimeoutError(undefined, { jobId, lastStatus: status })
    }

    await sleep(interval)
  }
}
