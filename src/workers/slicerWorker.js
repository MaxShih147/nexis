import mechadoModule from '@/three/wasm/slice/Mechado_wasm'
import { base64ToUint8Array } from '@/utils/fileUtils'
import { createImgData, processLayers } from '@/utils/imageUtils'

// Track mechado module initialization
let mechado = null
let isModuleInitializing = false

/**
 * Initialize the Mechado WASM module
 * @returns {Promise} Resolves when module is initialized
 */
async function initializeMechadoModule() {
  if (mechado)
    return mechado
  if (isModuleInitializing) {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (mechado) {
          clearInterval(checkInterval)
          resolve(mechado)
        }
      }, 100)
    })
  }

  isModuleInitializing = true
  try {
    mechado = await mechadoModule()
    return mechado
  }
  catch (error) {
    console.error('Failed to initialize Mechado module in worker:', error)
    throw error
  }
  finally {
    isModuleInitializing = false
  }
}

/**
 * Import configuration file to Mechado module
 * @param {object} config - Configuration object
 * @param {boolean} append - Whether to append to existing config
 * @returns {boolean} Success status
 */
async function importConfig(config, append = false) {
  try {
    const module = await initializeMechadoModule()
    await module.ImportConfigJSON_JS(config, append)
    return true
  }
  catch (error) {
    console.error('Failed to import configuration in worker:', error)
    throw error
  }
}

/**
 * Process a slicing job
 * @param {object} data - Job data from main thread
 * @param {Array} data.inds - Indices of the model
 * @param {Array} data.verts - Vertices of the model
 * @param {Array} data.matrix - Matrix of the model
 * @param {object} data.config - Configuration object
 * @param {Array} data.bedSize - Bed size of the printer
 * @param {Array} data.resolution - Resolution of the printer
 * @param {string} data.exportFileType - Type of file to export (gcode or prz)
 */
async function processSlice(data) {
  try {
    const { verts, matrix, config, bedSize, resolution, exportFileType, previewImgData } = data

    // Initialize the Mechado module
    const module = await initializeMechadoModule()

    // Import configuration with updated path
    await importConfig(config, false)
    // Create a copy of the vertex data to transform
    const transformedVerts = new Float32Array(verts)

    // Apply matrix transformation (if provided)
    if (matrix) {
      // Convert flat array back to 4x4 matrix form
      for (let i = 0; i < transformedVerts.length; i += 3) {
        const x = transformedVerts[i]
        const y = transformedVerts[i + 1]
        const z = transformedVerts[i + 2]

        // Apply matrix transformation
        transformedVerts[i] = matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]
        transformedVerts[i + 1] = matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]
        transformedVerts[i + 2] = matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]
      }
    }
    // Apply translation for print bed centering
    for (let i = 0; i < transformedVerts.length; i += 3) {
      transformedVerts[i] += (bedSize[0] || 200) / 2 // X translation
      transformedVerts[i + 1] += (bedSize[1] || 125) / 2 // Y translation
    }

    // Import model to Mechado module with transformed vertices
    module.ImportModel_JS([], transformedVerts, true)

    // Slice the model
    // module.Slice_JS('', 1)

    // Slice the model with multi-threading
    module.Slice_MultiThread_JS()

    // Get pixel surfaces
    const pixelSurfaces = module.GetPixelSurface_JS().filter(surface => surface.length > 0)
    // Process pixel surfaces and save as PNG blobs
    const pngBlobs = await processLayers(pixelSurfaces, false, resolution)

    const estimatedPrintTime = {
      value: module.GetFloatParamter_JS('Estimated Print Time').toFixed(2),
      unit: 's',
    }
    const volume = {
      value: (module.GetFloatParamter_JS('Volume') / 1000).toFixed(2),
      unit: 'ml',
    }
    const layerHeight = {
      value: module.GetFloatParamter_JS('Layer Height').toFixed(2),
      unit: 'mm',
    }

    const printData = {
      estimatedPrintTime,
      volume,
      layerHeight,
    }

    // Generate GCode
    const gcodeResult = module.GetGcode_JS()

    let przString = ''

    // Check if PRZ export is requested
    if (exportFileType === 'prz') {
      const pixels = await createImgData(pixelSurfaces, resolution)
      // Import pixels
      module.ImportPixels_JS(pixels)

      // Import preview image data
      module.SetPreviewImage_JS(...previewImgData)

      // Generate PRZ file
      przString = module.GetPRZ_JS()

      const przBytes = base64ToUint8Array(przString)
      przString = przBytes
    }

    // Send results back to main thread
    globalThis.postMessage({
      success: true,
      pixelSurfaces,
      pngBlobs,
      gcode: gcodeResult,
      printData,
      przString,
    })
  }
  catch (error) {
    console.error('Failed to process slice in worker:', error)
    globalThis.postMessage({
      success: false,
      error: error.message || String(error),
    })
  }
}

// Handle incoming messages
globalThis.onmessage = function (e) {
  processSlice(e.data)
}

// Setup worker environment for WASM and OffscreenCanvas
globalThis.HTMLCanvasElement = OffscreenCanvas

globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      return new OffscreenCanvas(300, 150)
    }
    throw new Error(`Unexpected createElement("${tag}")`)
  },
}
