import cv from '@techstark/opencv-js'

/**
 * Web Worker for processing batches of layers into compressed RLE data
 * Receives: { batch, resolution }
 * Returns: { batchResults } or { error }
 */

// OpenCV loading tracking
let cvReady = false
let pendingMessages = []

/**
 * Compress data using Run-Length Encoding (RLE)
 * @param {Uint8Array} data - The data to compress
 * @param {number} checkpoint - The number of pixels to check for consecutive values
 * @returns {Array} Array of [count, value] pairs
 */
function compressRLE(data, checkpoint = 10) {
  if (data.length === 0)
    return []

  const compressed = []
  let count = 1
  let currentValue = data[0]
  let i = 0
  while (i < data.length - 1) {
    if (i < data.length - checkpoint && data[i + checkpoint] === currentValue) {
      i += checkpoint
      count += checkpoint
    }
    else {
      i++
      if (data[i] === currentValue) {
        count++
      }
      else {
        compressed.push(count, currentValue)
        currentValue = data[i]
        count = 1
      }
    }
  }

  // Add the last run
  compressed.push(count, currentValue)

  return compressed
}

// Function to process a single layer
async function processLayer(layer, layerIndex, resolution) {
  try {
    if (!layer || layer.length === 0) {
      return {
        layerIndex,
        error: `Layer ${layerIndex} has no points`,
      }
    }

    const pointsVector = new cv.MatVector()

    layer.forEach((polygon) => {
      const surfaces = []
      polygon.forEach((vertex) => {
        surfaces.push(vertex[0], vertex[1])
      })
      const pointCount = surfaces.length / 2
      const pointsMat = cv.matFromArray(pointCount, 1, cv.CV_32SC2, surfaces)
      pointsVector.push_back(pointsMat)
    })

    const img = new cv.Mat(resolution[0], resolution[1], cv.CV_8UC1)
    img.setTo(new cv.Scalar(0, 0, 0))
    const color = new cv.Scalar(255, 255, 255)
    cv.fillPoly(img, pointsVector, color, 16, 10)

    // Use OpenCV-optimized RLE compression
    const compressedData = compressRLE(img.data)

    // Clean up OpenCV resources
    img.delete()
    pointsVector.delete()

    return {
      layerIndex,
      compressedData,
    }
  }
  catch (error) {
    console.error(error)
    return {
      layerIndex,
      error: `Failed to process layer ${layerIndex}: ${error.message || error}`,
    }
  }
}

// Function to process a batch of layers
async function processMessage(message) {
  const { batch, resolution } = message

  if (!cv) {
    globalThis.postMessage({
      error: 'OpenCV is not loaded in worker',
    })
    return
  }

  try {
    // Process each layer in the batch
    const batchResults = []

    // Process all layers in parallel
    const layerPromises = batch.map(({ layer, index }) =>
      processLayer(layer, index, resolution),
    )

    // Wait for all layers to be processed
    const results = await Promise.all(layerPromises)

    // Add each result to the batch results
    for (const result of results) {
      batchResults.push(result)
    }

    // Send all results at once
    globalThis.postMessage({
      batchResults,
    })
  }
  catch (error) {
    console.error(error)
    globalThis.postMessage({
      error: `Failed to process batch: ${error.message || error}`,
    })
  }
}

// Check if OpenCV is ready
if (cv.ready) {
  cvReady = true
}
else {
  // Set up a callback for when OpenCV is ready
  cv.onRuntimeInitialized = function () {
    cvReady = true
    // Process any pending messages
    pendingMessages.forEach(processMessage)
    pendingMessages = []
  }
}

// Handle incoming messages
globalThis.onmessage = function (e) {
  if (cvReady) {
    processMessage(e.data)
  }
  else {
    pendingMessages.push(e.data)
  }
}

// Set up OffscreenCanvas for OpenCV
globalThis.HTMLCanvasElement = OffscreenCanvas

// Mock document.createElement for OpenCV
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      return new OffscreenCanvas(300, 150)
    }
    throw new Error(`Unexpected createElement("${tag}")`)
  },
}
