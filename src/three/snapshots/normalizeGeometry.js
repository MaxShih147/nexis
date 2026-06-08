import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Uint32BufferAttribute } from 'three'

/**
 * Canonicalize a BufferGeometry into a serializable payload for the worker.
 * CRITICAL: .slice() every ArrayBuffer so later scene ops cannot mutate bytes.
 *
 * @param {BufferGeometry} geometry
 * @returns {{ attributes: Array<{ name: string, itemSize: number, array: TypedArray }>, index: { array: TypedArray, itemSize: number } | null }} geometry
 */
export function canonicalizeGeometry(geometry) {
  const ATTR_ORDER = ['position', 'normal', 'uv']
  const attributes = []

  for (const name of ATTR_ORDER) {
    const attr = geometry.attributes[name]
    if (!attr)
      continue
    // .slice() ensures an independent copy
    attributes.push({
      name,
      itemSize: attr.itemSize,
      array: attr.array.slice(),
    })
  }

  let index = null
  if (geometry.index) {
    index = {
      array: geometry.index.array.slice(),
      itemSize: 1,
    }
  }

  return { attributes, index }
}

/**
 * Rebuild a BufferGeometry from decoded attribute arrays.
 *
 * @param {{ attributes: Array<{ name: string, itemSize: number, array: TypedArray }>, index: TypedArray|null }} decoded
 * @returns {BufferGeometry} Rebuilt BufferGeometry
 */
export function rebuildGeometry(decoded) {
  const geometry = new BufferGeometry()

  for (const { name, itemSize, array } of decoded.attributes) {
    if (array instanceof Float32Array) {
      geometry.setAttribute(name, new Float32BufferAttribute(array, itemSize))
    }
    else if (array instanceof Uint32Array) {
      geometry.setAttribute(name, new Uint32BufferAttribute(array, itemSize))
    }
    else if (array instanceof Uint16Array) {
      geometry.setAttribute(name, new Uint16BufferAttribute(array, itemSize))
    }
    else {
      geometry.setAttribute(name, new Float32BufferAttribute(new Float32Array(array), itemSize))
    }
  }

  if (decoded.index) {
    if (decoded.index instanceof Uint32Array) {
      geometry.setIndex(new Uint32BufferAttribute(decoded.index, 1))
    }
    else if (decoded.index instanceof Uint16Array) {
      geometry.setIndex(new Uint16BufferAttribute(decoded.index, 1))
    }
    else {
      geometry.setIndex(new Uint32BufferAttribute(new Uint32Array(decoded.index), 1))
    }
  }

  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()

  // Recompute normals if position exists but normal doesn't
  if (geometry.attributes.position && !geometry.attributes.normal) {
    geometry.computeVertexNormals()
  }

  return geometry
}

/**
 * Flatten canonical geometry into a single Uint8Array for hashing.
 * Attributes are concatenated in stable order.
 *
 * @param {{ attributes: Array, index: object|null }} canonical
 * @returns {Uint8Array} flattened array
 */
export function canonicalToBytes(canonical) {
  let totalBytes = 0
  for (const attr of canonical.attributes) {
    totalBytes += attr.array.byteLength
  }
  if (canonical.index) {
    totalBytes += canonical.index.array.byteLength
  }

  const buffer = new Uint8Array(totalBytes)
  let offset = 0
  for (const attr of canonical.attributes) {
    const view = new Uint8Array(attr.array.buffer, attr.array.byteOffset, attr.array.byteLength)
    buffer.set(view, offset)
    offset += view.length
  }
  if (canonical.index) {
    const view = new Uint8Array(canonical.index.array.buffer, canonical.index.array.byteOffset, canonical.index.array.byteLength)
    buffer.set(view, offset)
  }

  return buffer
}
