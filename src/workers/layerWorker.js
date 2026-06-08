import cv from '@techstark/opencv-js'
import { encode } from 'fast-png'

/**
 * Web Worker for processing batches of layers into PNG blobs
 * Receives: { batch, forPrint }
 * Returns: { batchResults } or { error }
 */

// OpenCV loading tracking
let cvReady = false
let pendingMessages = []

// Function to process a single layer
async function processLayer(layer, layerIndex, forPrint, imageSize) {
  try {
    if (!layer || layer.length === 0) {
      return {
        layerIndex,
        error: `Layer ${layerIndex} has no points`,
      }
    }

    const scale = forPrint ? 1 : 0.25
    const resolution = [imageSize[0] * scale, imageSize[1] * scale]
    const pointsVector = new cv.MatVector()

    layer.forEach((polygon) => {
      const surfaces = []
      polygon.forEach((vertex) => {
        const x = vertex[0] * scale
        const y = vertex[1] * scale
        surfaces.push(x, y)
      })

      const pointCount = surfaces.length / 2
      const pointsMat = cv.matFromArray(pointCount, 1, cv.CV_32SC2, surfaces)
      pointsVector.push_back(pointsMat)
    })

    const img = new cv.Mat(resolution[0], resolution[1], cv.CV_8UC1)
    img.setTo(new cv.Scalar(0, 0, 0))
    const color = new cv.Scalar(255, 255, 255)
    cv.fillPoly(img, pointsVector, color, 16, 10)
    if (!forPrint) {
      cv.flip(img, img, 1)
    }

    const pngData = encode({
      width: img.cols,
      height: img.rows,
      data: img.data,
      depth: 8,
      channels: 1,
    })

    const blob = new Blob([pngData], { type: 'image/png' })

    // Clean up OpenCV resources
    img.delete()
    pointsVector.delete()

    return {
      layerIndex,
      imgObject: {
        filename: `${layerIndex + 1}.png`,
        blob,
      },
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
  const { batch, forPrint, resolution } = message

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
      processLayer(layer, index, forPrint, resolution),
    )

    // Wait for all layers to be processed
    const results = await Promise.all(layerPromises)

    // Add each result to the batch results
    for (const result of results) {
      batchResults.push(result)
    }

    // Send all results at once with transferable objects
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

// 將globalThis.HTMLCanvasElement設為OffscreenCanvas
globalThis.HTMLCanvasElement = OffscreenCanvas

// 因為opencv.js會跑document.createElement("canvas")，所以讓他改成create OffscreenCanvas
globalThis.document = {
  createElement(tag) {
    if (tag === 'canvas') {
      // width/height here only matter if OpenCV.cpp wants to size it—
      // you'll do your own sizing on the real OffscreenCanvas you transfer later.
      return new OffscreenCanvas(300, 150)
    }
    throw new Error(`Unexpected createElement("${tag}")`)
  },
}
