/**
 * Web Worker for decoding backend PNG layers into 1-channel mask data and RLE-compressing it.
 * Uses fast-png (pure JS decode) so decoding never depends on createImageBitmap and is 100% reliable
 * across platforms (avoids Chrome macOS Worker decode failures).
 * Receives: { batch, width, height }
 * Returns: { batchResults } or { error }
 */

import { decode } from 'fast-png'

const MASK_THRESHOLD = 127

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

  compressed.push(count, currentValue)
  return compressed
}

/**
 * Decode PNG blob to mask using fast-png (pure JS). No createImageBitmap → 100% success on all platforms.
 */
async function decodeBlobToMask(blob, width, height) {
  const arrayBuffer = await blob.arrayBuffer()
  const decoded = decode(new Uint8Array(arrayBuffer))

  const w = decoded.width
  const h = decoded.height
  const data = decoded.data
  const channels = decoded.channels ?? 4

  if (w !== width || h !== height) {
    throw new Error(`Decoded size ${w}x${h} does not match expected ${width}x${height}`)
  }

  const mask = new Uint8Array(w * h)
  let alpha255Count = 0
  let alphaZeroCount = 0

  if (channels === 1) {
    for (let i = 0; i < data.length; i++) {
      mask[i] = data[i] > MASK_THRESHOLD ? 255 : 0
    }
    alpha255Count = 0
    alphaZeroCount = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 255)
        alpha255Count++
      if (data[i] === 0)
        alphaZeroCount++
    }
  }
  else {
    for (let i = 0, j = 0; i < data.length; i += channels, j++) {
      const r = data[i]
      const g = channels >= 2 ? data[i + 1] : r
      const b = channels >= 3 ? data[i + 2] : r
      const a = channels >= 4 ? data[i + 3] : 255

      if (a === 255)
        alpha255Count++
      if (a === 0)
        alphaZeroCount++

      if (a === 0) {
        mask[j] = 0
        continue
      }
      const gray = (r + g + b) / 3
      mask[j] = gray > MASK_THRESHOLD ? 255 : 0
    }
  }

  return {
    mask,
    debug: {
      sourceWidth: w,
      sourceHeight: h,
      targetWidth: width,
      targetHeight: height,
      totalPixels: w * h,
      alpha255Count,
      alphaZeroCount,
      isFullyOpaque: alpha255Count === w * h,
    },
  }
}

async function processLayer({ layerIndex, blob }, width, height) {
  try {
    const { mask, debug } = await decodeBlobToMask(blob, width, height)
    return {
      layerIndex,
      compressedData: compressRLE(mask),
      debug,
    }
  }
  catch (error) {
    return {
      layerIndex,
      error: `Failed to process layer ${layerIndex}: ${error?.message || error}`,
    }
  }
}

async function processMessage(message) {
  const { batch, width, height } = message || {}
  if (!Array.isArray(batch)) {
    globalThis.postMessage({ error: 'Invalid batch payload' })
    return
  }

  try {
    const batchResults = await Promise.all(
      batch.map(layer => processLayer(layer, width, height)),
    )
    globalThis.postMessage({ batchResults })
  }
  catch (error) {
    globalThis.postMessage({
      error: `Failed to process batch: ${error?.message || error}`,
    })
  }
}

globalThis.onmessage = (e) => {
  processMessage(e.data).catch((error) => {
    globalThis.postMessage({
      error: `Failed to process message: ${error?.message || error}`,
    })
  })
}
