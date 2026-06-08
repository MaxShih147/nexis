import { logger } from '@/utils/logger'
// import { encode } from 'fast-png'
import cv from '@techstark/opencv-js'
import layerWorker from '../workers/layerWorker.js?worker'
import rleWorker from '../workers/rleWorker.js?worker'
import { WorkerPoolManager } from './workerPoolManager.js'

/**
 * Compress data using Run-Length Encoding (RLE)
 * @param {Uint8Array} data - The data to compress
 * @returns {Array} Array of [count, value] pairs
 */
function compressRLE(data) {
  if (data.length === 0)
    return []

  const compressed = []
  let currentValue = data[0]
  let count = 1

  for (let i = 1; i < data.length; i++) {
    if (data[i] === currentValue) {
      count++
    }
    else {
      compressed.push(count, currentValue)
      currentValue = data[i]
      count = 1
    }
  }

  // Add the last run
  compressed.push(count, currentValue)

  return compressed
}

/**
 * Process multiple layers into PNG blobs concurrently using web workers
 * @param {Array} layers - Array of layers (each containing polygons)
 * @param {boolean} forPrint - Whether to use print or preview resolution
 * @param {Array} resolution - Resolution of the image
 * @param {Function} onProgress - Optional callback for progress updates
 * @returns {Promise<Array>} Array of PNG blob objects
 */
export async function processLayers(layers, forPrint = false, resolution, onProgress = null) {
  if (layers.length === 0) {
    throw new Error('No layers provided for processing')
  }

  // add index to each layer
  const indexedLayers = layers.map((layer, index) => ({ layer, index }))

  // Fall back to sequential processing if web workers are not supported
  if (typeof Worker === 'undefined') {
    logger.warn('Web Workers not supported, falling back to sequential processing')
    return processLayersSequentially(indexedLayers.map(item => item.layer), forPrint, resolution, onProgress)
  }

  let pool = null
  try {
    // 決定 worker pool 大小
    const workerCount = Math.min(navigator.hardwareConcurrency, 4)
    // 計算 batch size
    const batchSize = Math.min(100, Math.max(1, Math.ceil(indexedLayers.length / workerCount)))
    // 切分 batch
    const layerBatches = []
    for (let i = 0; i < indexedLayers.length; i += batchSize) {
      layerBatches.push(indexedLayers.slice(i, i + batchSize))
    }

    // 建立 WorkerPoolManager
    pool = new WorkerPoolManager(layerWorker, {
      poolSize: workerCount,
      taskTimeout: 30000,
    })
    const results = new Map()
    // const finishedCount = 0

    // 依序送出 batch 任務
    await Promise.all(layerBatches.map(async (batch) => {
      try {
        const { batchResults, error } = await pool.enqueueTask({
          batch,
          forPrint,
          resolution,
        })

        if (error) {
          logger.error('Worker error processing batch:', error)
          throw new Error(`Worker error: ${error.message}`)
        }
        if (!batchResults || !Array.isArray(batchResults) || batchResults.length === 0) {
          logger.error('No results returned from worker for batch:', batch)
          throw new Error('No results returned from worker')
        }

        batchResults.forEach(({ layerIndex, imgObject }) => {
          if (!imgObject) {
            logger.error('imgObject is null for layerIndex', layerIndex)
            return
          }
          results.set(layerIndex, imgObject)
          if (onProgress && typeof onProgress === 'function') {
            onProgress(layerIndex)
          }
        })
      }
      catch (err) {
        logger.error('WorkerPoolManager task failed:', err)
      }
    }))

    // 回傳排序後結果
    // Map 的遍歷順序是插入順序，不是 key 排序
    return Array.from(results.entries())
      .sort(([a], [b]) => a - b)
      .map(([, blob]) => blob)
  }
  catch (error) {
    logger.error('Error setting up workers, falling back to sequential processing:', error)
    return processLayersSequentially(indexedLayers.map(item => item.layer), forPrint, onProgress)
  }
  finally {
    // Always clean up worker resources
    if (pool) {
      pool.terminateAll()
    }
  }
}

/**
 * Process layers sequentially (fallback method)
 * @param {Array} _layers - Array of layers (each containing polygons)
 * @param {boolean} _forPrint - Whether to use print or preview resolution
 * @param {Function} _onProgress - Optional callback for progress updates
 * @returns {Promise<Array>} Array of PNG blob objects
 */
async function processLayersSequentially(_layers, _forPrint = false, _onProgress = null) {
  // to be implemented
  logger.warn('Sequential processing in progress, this may have errors')
  // layers.forEach((layer, layerIndex) => {
  //   try {
  //     if (!layer || layer.length === 0) {
  //       console.warn(`Layer ${layerIndex} is empty or undefined`)
  //       throw new Error(`Layer ${layerIndex} is empty or undefined`)
  //     }

  //     const scale = forPrint ? 1 : 0.25
  //     const resolution = [imageSize[0] * scale, imageSize[1] * scale]
  //     const pointsVector = new cv.MatVector()

  //     layer.forEach((polygon) => {
  //       const surfaces = []
  //       polygon.forEach((vertex) => {
  //         const x = vertex[0] * scale
  //         const y = vertex[1] * scale
  //         surfaces.push(x, y)
  //       })

  //       const pointCount = surfaces.length / 2
  //       const pointsMat = cv.matFromArray(pointCount, 1, cv.CV_32SC2, surfaces)
  //       pointsVector.push_back(pointsMat)
  //     })

  //     const img = new cv.Mat(resolution[0], resolution[1], cv.CV_8UC1)
  //     img.setTo(new cv.Scalar(0, 0, 0))
  //     const color = new cv.Scalar(255, 255, 255)
  //     cv.fillPoly(img, pointsVector, color, 16, 10)
  //     if (!forPrint) {
  //       cv.flip(img, img, 1)
  //     }

  //     const pngData = encode({
  //       width: img.cols,
  //       height: img.rows,
  //       data: img.data,
  //       depth: 8,
  //       channels: 1,
  //     })

  //     const alphaArray = new Uint8Array(img.data)

  //     const blob = new Blob([pngData], { type: 'image/png' })

  //     // Clean up OpenCV resources
  //     img.delete()
  //     pointsVector.delete()

  //     return {
  //       layerIndex,
  //       imgObject: {
  //         pngData: alphaArray,
  //         filename: `${layerIndex + 1}.png`,
  //         blob,
  //       },
  //     }
  //   }
  //   catch (error) {
  //     console.error(error)
  //   }
  // })
}

export async function createImgData(layers, resolution) {
  if (layers.length === 0) {
    throw new Error('No layers provided for processing')
  }

  // add index to each layer
  const indexedLayers = layers.map((layer, index) => ({ layer, index }))

  // Fall back to sequential processing if web workers are not supported
  if (typeof Worker === 'undefined') {
    logger.warn('Web Workers not supported, falling back to sequential processing')
    return createImgDataSequentially(indexedLayers.map(item => item.layer), resolution)
  }

  let pool = null
  try {
    // Determine worker pool size (up to 4 workers)
    const workerCount = Math.min(navigator.hardwareConcurrency || 4, 4)
    // Calculate batch size
    const batchSize = Math.min(100, Math.max(1, Math.ceil(indexedLayers.length / workerCount)))
    // Split into batches
    const layerBatches = []
    for (let i = 0; i < indexedLayers.length; i += batchSize) {
      layerBatches.push(indexedLayers.slice(i, i + batchSize))
    }

    // Create WorkerPoolManager
    pool = new WorkerPoolManager(rleWorker, {
      poolSize: workerCount,
      taskTimeout: 30000,
    })
    const results = new Map()

    // Process batches in parallel
    await Promise.all(layerBatches.map(async (batch) => {
      try {
        const { batchResults, error } = await pool.enqueueTask({
          batch,
          resolution,
        })

        if (error) {
          logger.error('Worker error processing batch:', error)
          throw new Error(`Worker error: ${error.message}`)
        }
        if (!batchResults || !Array.isArray(batchResults) || batchResults.length === 0) {
          logger.error('No results returned from worker for batch:', batch)
          throw new Error('No results returned from worker')
        }

        batchResults.forEach(({ layerIndex, compressedData, error }) => {
          if (error) {
            logger.error(`Error processing layer ${layerIndex}:`, error)
            return
          }
          if (!compressedData) {
            logger.error('compressedData is null for layerIndex', layerIndex)
            return
          }
          results.set(layerIndex, compressedData)
        })
      }
      catch (err) {
        logger.error('WorkerPoolManager task failed:', err)
        throw err
      }
    }))

    // Return sorted results
    return Array.from(results.entries())
      .sort(([a], [b]) => a - b)
      .map(([, compressedData]) => compressedData)
  }
  catch (error) {
    logger.error('Error setting up workers, falling back to sequential processing:', error)
    return createImgDataSequentially(indexedLayers.map(item => item.layer), resolution)
  }
  finally {
    // Always clean up worker resources
    if (pool) {
      pool.terminateAll()
    }
  }
}

/**
 * Sequential fallback implementation for createImgData
 * @param {Array} layers - Array of layers (each containing polygons)
 * @param {Array} resolution - Resolution of the image
 * @returns {Promise<Array>} Array of compressed data
 */
async function createImgDataSequentially(layers, resolution) {
  return await Promise.all(layers.map((layer) => {
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

    return compressedData
  }))
}

/**
 * Extract RGB or alpha data from raw RGBA data
 * @param {Uint8Array} rawData - Raw RGBA data array
 * @param {number} channels - Number of channels (1 for alpha, 3 for RGB)
 * @returns {Uint8Array} Processed data array
 */
export function getRGB(rawData, channels) {
  if (!rawData || !(rawData instanceof Uint8Array || rawData instanceof Uint8ClampedArray)) {
    throw new Error('Invalid input: rawData must be a Uint8Array or Uint8ClampedArray')
  }

  if (channels !== 1 && channels !== 3) {
    throw new Error('Invalid channels: must be either 1 (alpha) or 3 (RGB)')
  }

  const pixelCount = rawData.length / 4 // Each pixel has 4 components (RGBA)
  const result = new Uint8Array(pixelCount * channels)

  if (channels === 1) {
    // Extract alpha channel (every 4th value)
    for (let i = 0; i < pixelCount; i++) {
      result[i] = rawData[i * 4 + 3]
    }
  }
  else {
    // Extract RGB channels (skip alpha)
    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = i * 4
      const destIdx = i * 3
      result[destIdx] = rawData[srcIdx] // R
      result[destIdx + 1] = rawData[srcIdx + 1] // G
      result[destIdx + 2] = rawData[srcIdx + 2] // B
    }
  }

  return result
}
