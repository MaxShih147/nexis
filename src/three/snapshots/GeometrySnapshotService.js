import { logger } from '@/utils/logger'
import { canonicalizeGeometry, canonicalToBytes, rebuildGeometry } from './normalizeGeometry.js'

const DEFAULT_MAX_HOT = 3
const DEFAULT_MAX_COLD_BYTES = 2 * 1024 * 1024 * 1024 // 2 GB

/**
 * GeometrySnapshotService — content-addressed, deduplicated snapshot management.
 *
 * HOT: LRU cache of decoded geometries (max 3).
 * COLD: compressed blobs in SnapshotStore (IndexedDB).
 *
 * All hashing, encoding, and decoding happens in a WorkerPool.
 */
export class GeometrySnapshotService {
  /**
   * @param {WorkerPool} workerPool
   * @param {SnapshotStore} store
   * @param {object} [opts]
   * @param {number} [opts.maxHotDecoded]
   * @param {number} [opts.maxColdBytesTotal]
   */
  constructor(workerPool, store, opts = {}) {
    this._pool = workerPool
    this._store = store
    this._maxHot = opts.maxHotDecoded ?? DEFAULT_MAX_HOT
    this._maxCold = opts.maxColdBytesTotal ?? DEFAULT_MAX_COLD_BYTES

    // HOT cache: hash → { geometry (BufferGeometry), lastAccess (number) }
    this._hot = new Map()

    // Track all hashes referenced by current snapshot operations
    // Each entry: hash → refCount (how many snapshot refs point here)
    this._refCount = new Map()

    // Dev timing stats
    this._timings = { hash_ms: [], encode_ms: [], decode_ms: [], apply_ms: [] }
  }

  /**
   * Snapshot a BufferGeometry: canonicalize → hash → encode → store.
   * Returns a SnapshotRef { hash } that can later restore the geometry.
   *
   * @param {BufferGeometry} geometry
   * @returns {Promise<{ hash: string }>} SnapshotRef { hash } that can later restore the geometry.
   */
  async snapshotGeometry(geometry) {
    const t0 = performance.now()

    // Canonicalize (slice all buffers for safety)
    const canonical = canonicalizeGeometry(geometry)
    const bytes = canonicalToBytes(canonical)

    // Hash (in worker)
    const { hash } = await this._pool.hash(bytes)
    const tHash = performance.now()
    this._recordTiming('hash_ms', tHash - t0)

    // Increment ref count
    this._refCount.set(hash, (this._refCount.get(hash) || 0) + 1)

    // Deduplicate: only encode & store if new
    if (await this._store.has(hash)) {
      await this._store.touch(hash)
      return { hash }
    }

    // Encode (in worker)
    const tEnc0 = performance.now()
    const encoded = await this._pool.encode(canonical)
    const tEnc1 = performance.now()
    this._recordTiming('encode_ms', tEnc1 - tEnc0)

    // Store to COLD
    await this._store.put(hash, encoded.blob, {
      codec: encoded.codec,
      bytes: encoded.compressedBytes,
      createdAt: Date.now(),
    })

    return { hash }
  }

  /**
   * Load (decode) a geometry from a SnapshotRef.
   * Returns a cloned BufferGeometry (caller owns it).
   *
   * @param {{ hash: string }} ref
   * @returns {Promise<BufferGeometry>} cloned BufferGeometry
   */
  async loadGeometry(ref) {
    const { hash } = ref

    // Check HOT cache
    const hot = this._hot.get(hash)
    if (hot) {
      hot.lastAccess = Date.now()
      return hot.geometry.clone()
    }

    // Load from COLD
    const record = await this._store.get(hash)
    if (!record) {
      throw new Error(`[GeometrySnapshotService] Snapshot not found: ${hash}`)
    }

    await this._store.touch(hash)

    // Decode (in worker)
    const tDec0 = performance.now()
    const decoded = await this._pool.decode(record.blob, record.meta.codec)
    const tDec1 = performance.now()
    this._recordTiming('decode_ms', tDec1 - tDec0)

    // Rebuild geometry
    const tApply0 = performance.now()
    const geometry = rebuildGeometry(decoded)
    const tApply1 = performance.now()
    this._recordTiming('apply_ms', tApply1 - tApply0)

    // Cache in HOT
    this._addToHotCache(hash, geometry)

    return geometry.clone()
  }

  /**
   * Mark-and-sweep GC. Called by UndoManager after push with a debounce.
   * @param {Set<string>} referencedHashes  hashes still referenced by undo/redo stacks
   */
  async sweep(referencedHashes) {
    try {
      const totalBytes = await this._store.getTotalBytes()
      if (totalBytes <= this._maxCold)
        return

      // Collect all stored hashes and metadata
      const allMeta = []
      for await (const { hash, meta } of this._store.iterateMeta()) {
        allMeta.push({ hash, ...meta })
      }

      // Sort unreferenced by lastAccess ascending (oldest first)
      const unreferenced = allMeta
        .filter(m => !referencedHashes.has(m.hash) && !this._refCount.has(m.hash))
        .sort((a, b) => a.lastAccess - b.lastAccess)

      // Delete oldest unreferenced until under budget
      const target = this._maxCold * 0.8
      let currentBytes = totalBytes
      for (const entry of unreferenced) {
        if (currentBytes <= target)
          break
        await this._store.del(entry.hash)
        this._hot.delete(entry.hash)
        currentBytes -= entry.bytes || 0
      }
    }
    catch (err) {
      logger.warn('[GeometrySnapshotService] GC sweep error:', err)
    }
  }

  // ------------- HOT cache ------------------

  _addToHotCache(hash, geometry) {
    // Evict oldest if full
    while (this._hot.size >= this._maxHot) {
      let oldestKey = null
      let oldestTime = Infinity
      for (const [k, v] of this._hot) {
        if (v.lastAccess < oldestTime) {
          oldestTime = v.lastAccess
          oldestKey = k
        }
      }
      if (oldestKey) {
        const evicted = this._hot.get(oldestKey)
        evicted.geometry.dispose()
        this._hot.delete(oldestKey)
      }
    }

    this._hot.set(hash, { geometry: geometry.clone(), lastAccess: Date.now() })
  }

  // ------------- dev timings ------------------

  _recordTiming(key, ms) {
    const arr = this._timings[key]
    arr.push(ms)
    // Keep last 100
    if (arr.length > 100)
      arr.shift()
  }

  getTimingStats() {
    const stats = {}
    for (const [key, arr] of Object.entries(this._timings)) {
      if (arr.length === 0) {
        stats[key] = { p50: 0, p95: 0, count: 0 }
        continue
      }
      const sorted = [...arr].sort((a, b) => a - b)
      stats[key] = {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        count: sorted.length,
      }
    }
    return stats
  }

  /** Dispose resources. */
  dispose() {
    for (const { geometry } of this._hot.values()) {
      geometry.dispose()
    }
    this._hot.clear()
    this._refCount.clear()
  }
}
