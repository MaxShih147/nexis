/**
 * Combined worker for snapshot operations: HASH, ENCODE, DECODE.
 * Runs off the main thread to prevent UI jank.
 *
 * Message protocol:
 *   { id, type: 'HASH'|'ENCODE'|'DECODE', payload }
 * Response:
 *   { id, type, result } | { id, type, error }
 */
import pako from 'pako'

// ---------------------------------------------------------------------------
// HASH — SHA-256 via Web Crypto
// ---------------------------------------------------------------------------

async function hashBytes(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  const arr = new Uint8Array(digest)
  let hex = ''
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0')
  }
  return hex
}

// ---------------------------------------------------------------------------
// ENCODE — quantize float32→int16 + pako.deflate  (codec: "qgzip")
// ---------------------------------------------------------------------------

/**
 * Encode canonical geometry data into a compressed blob.
 *
 * Input payload:
 *   { attributes: [{ name, itemSize, array: Float32Array|Uint32Array|... }], index: { array, itemSize } | null }
 *
 * Output:
 *   { blob: Uint8Array, codec: 'qgzip', originalBytes, compressedBytes }
 */
function encode(payload) {
  const { attributes, index } = payload
  const headerAttrs = []
  const binaryParts = []
  let byteOffset = 0

  for (const attr of attributes) {
    const { name, itemSize, array } = attr
    const count = array.length / itemSize
    const isFloat = array instanceof Float32Array

    if (isFloat) {
      // Quantize float32 → int16
      const componentCount = array.length
      const min = new Float64Array(itemSize)
      const max = new Float64Array(itemSize)
      min.fill(Infinity)
      max.fill(-Infinity)

      // Find per-component min/max
      for (let i = 0; i < count; i++) {
        for (let c = 0; c < itemSize; c++) {
          const v = array[i * itemSize + c]
          if (v < min[c])
            min[c] = v
          if (v > max[c])
            max[c] = v
        }
      }

      // Quantize
      const quantized = new Int16Array(componentCount)
      for (let c = 0; c < itemSize; c++) {
        const range = max[c] - min[c]
        const scale = range > 0 ? 32767 / range : 0
        for (let i = 0; i < count; i++) {
          const idx = i * itemSize + c
          quantized[idx] = Math.round((array[idx] - min[c]) * scale)
        }
      }

      const byteLength = quantized.byteLength
      headerAttrs.push({
        name,
        itemSize,
        count,
        dtype: 'int16',
        min: Array.from(min),
        max: Array.from(max),
        byteOffset,
        byteLength,
      })
      binaryParts.push(new Uint8Array(quantized.buffer, quantized.byteOffset, quantized.byteLength))
      byteOffset += byteLength
    }
    else {
      // Store integer types as-is (e.g. Uint32Array index)
      const typeName = array instanceof Uint32Array
        ? 'uint32'
        : array instanceof Uint16Array
          ? 'uint16'
          : array instanceof Int32Array
            ? 'int32'
            : 'uint8'
      const byteLength = array.byteLength
      headerAttrs.push({
        name,
        itemSize,
        count,
        dtype: typeName,
        byteOffset,
        byteLength,
      })
      binaryParts.push(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
      byteOffset += byteLength
    }
  }

  // Handle index
  let indexHeader = null
  if (index && index.array) {
    const arr = index.array
    const dtype = arr instanceof Uint32Array ? 'uint32' : 'uint16'
    const byteLength = arr.byteLength
    indexHeader = {
      count: arr.length,
      dtype,
      byteOffset,
      byteLength,
    }
    binaryParts.push(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength))
    byteOffset += byteLength
  }

  // Build uncompressed payload: [4-byte headerLen] [JSON header] [binary data]
  const headerObj = { attributes: headerAttrs, index: indexHeader }
  const headerStr = JSON.stringify(headerObj)
  const headerBytes = new TextEncoder().encode(headerStr)

  const totalLen = 4 + headerBytes.length + byteOffset
  const uncompressed = new Uint8Array(totalLen)
  const view = new DataView(uncompressed.buffer)
  view.setUint32(0, headerBytes.length, true) // little-endian
  uncompressed.set(headerBytes, 4)

  let offset = 4 + headerBytes.length
  for (const part of binaryParts) {
    uncompressed.set(part, offset)
    offset += part.length
  }

  // Compress
  const blob = pako.deflate(uncompressed)

  return {
    blob,
    codec: 'qgzip',
    originalBytes: totalLen,
    compressedBytes: blob.length,
  }
}

// ---------------------------------------------------------------------------
// DECODE — pako.inflate + dequantize int16→float32
// ---------------------------------------------------------------------------

function decode(payload) {
  const { blob, codec } = payload
  if (codec !== 'qgzip') {
    throw new Error(`Unknown codec: ${codec}`)
  }

  const uncompressed = pako.inflate(blob)
  const view = new DataView(uncompressed.buffer, uncompressed.byteOffset, uncompressed.byteLength)
  const headerLen = view.getUint32(0, true)
  const headerStr = new TextDecoder().decode(uncompressed.slice(4, 4 + headerLen))
  const header = JSON.parse(headerStr)
  const dataStart = 4 + headerLen

  const attributes = []
  for (const attr of header.attributes) {
    const raw = uncompressed.slice(dataStart + attr.byteOffset, dataStart + attr.byteOffset + attr.byteLength)

    if (attr.dtype === 'int16') {
      // Dequantize int16 → float32
      const quantized = new Int16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)
      const float32 = new Float32Array(quantized.length)
      const { itemSize, count, min, max } = attr

      for (let c = 0; c < itemSize; c++) {
        const range = max[c] - min[c]
        const invScale = range > 0 ? range / 32767 : 0
        for (let i = 0; i < count; i++) {
          const idx = i * itemSize + c
          float32[idx] = quantized[idx] * invScale + min[c]
        }
      }

      attributes.push({ name: attr.name, itemSize: attr.itemSize, array: float32 })
    }
    else {
      // Integer types
      let array
      if (attr.dtype === 'uint32')
        array = new Uint32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
      else if (attr.dtype === 'uint16')
        array = new Uint16Array(raw.buffer, raw.byteOffset, raw.byteLength / 2)
      else if (attr.dtype === 'int32')
        array = new Int32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
      else array = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)

      // Slice to own buffer
      array = array.slice()
      attributes.push({ name: attr.name, itemSize: attr.itemSize, array })
    }
  }

  let index = null
  if (header.index) {
    const idxRaw = uncompressed.slice(dataStart + header.index.byteOffset, dataStart + header.index.byteOffset + header.index.byteLength)
    if (header.index.dtype === 'uint32') {
      index = new Uint32Array(idxRaw.buffer, idxRaw.byteOffset, idxRaw.byteLength / 4).slice()
    }
    else {
      index = new Uint16Array(idxRaw.buffer, idxRaw.byteOffset, idxRaw.byteLength / 2).slice()
    }
  }

  return { attributes, index }
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

globalThis.onmessage = async (e) => {
  const { id, type, payload } = e.data
  try {
    let result
    if (type === 'HASH') {
      const hash = await hashBytes(payload.buffer)
      result = { hash }
    }
    else if (type === 'ENCODE') {
      result = encode(payload)
      // Transfer the blob buffer
      globalThis.postMessage({ id, type, result }, [result.blob.buffer])
      return
    }
    else if (type === 'DECODE') {
      result = decode(payload)
      // Transfer attribute buffers
      const transferables = result.attributes.map(a => a.array.buffer)
      if (result.index)
        transferables.push(result.index.buffer)
      globalThis.postMessage({ id, type, result }, transferables)
      return
    }
    else {
      throw new Error(`Unknown message type: ${type}`)
    }
    globalThis.postMessage({ id, type, result })
  }
  catch (err) {
    globalThis.postMessage({ id, type, error: err.message || String(err) })
  }
}
