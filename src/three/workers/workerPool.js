/**
 * WorkerPool — manages snapshot worker(s) for off-main-thread
 * hashing, encoding, and decoding of geometry snapshots.
 *
 * Priority: DECODE > HASH > ENCODE
 */

import { logger } from '@/utils/logger'

const PRIORITY = { DECODE: 0, HASH: 1, ENCODE: 2 }

export class WorkerPool {
  /**
   * @param {number} [poolSize]  number of worker instances
   */
  constructor(poolSize = 2) {
    this._workers = []
    this._busy = new Set()
    this._jobId = 0
    this._pending = new Map() // jobId → { resolve, reject }
    this._queue = [] // { id, type, payload, priority, resolve, reject, transferables }

    for (let i = 0; i < poolSize; i++) {
      const w = new Worker(
        new URL('./snapshot.worker.js', import.meta.url),
        { type: 'module' },
      )
      w.onmessage = e => this._onMessage(i, e)
      w.onerror = e => this._onError(i, e)
      this._workers.push(w)
    }
  }

  // ------------- public API ------------------

  /**
   * Hash a geometry buffer (SHA-256).
   * @param {Uint8Array} buffer  canonical geometry bytes
   * @returns {Promise<{ hash: string }>} A promise resolving to the computed SHA-256 hash.
   */
  hash(buffer) {
    return this._dispatch('HASH', { buffer }, PRIORITY.HASH, [buffer.buffer])
  }

  /**
   * Encode geometry attributes into a compressed blob.
   * @param {{ attributes: Array, index: object|null }} payload
   * @returns {Promise<{ blob: Uint8Array, codec: string, originalBytes: number, compressedBytes: number }>} A promise resolving to the encoded geometry payload.
   */
  encode(payload) {
    return this._dispatch('ENCODE', payload, PRIORITY.ENCODE)
  }

  /**
   * Decode a compressed blob back into typed arrays.
   * @param {Uint8Array} blob
   * @param {string} codec
   * @returns {Promise<{ attributes: Array, index: Uint32Array|Uint16Array|null }>} A promise resolving to the decoded geometry attributes and index buffer.
   */
  decode(blob, codec) {
    return this._dispatch('DECODE', { blob, codec }, PRIORITY.DECODE)
  }

  /** Terminate all workers. */
  dispose() {
    for (const w of this._workers) {
      w.terminate()
    }
    this._workers.length = 0
    for (const { reject } of this._pending.values()) {
      reject(new Error('WorkerPool disposed'))
    }
    this._pending.clear()
    this._queue.length = 0
  }

  // ------------- internals ------------------

  _dispatch(type, payload, priority, transferables) {
    return new Promise((resolve, reject) => {
      const id = ++this._jobId
      const job = { id, type, payload, priority, resolve, reject, transferables }

      // Try to dispatch immediately to a free worker
      const freeIdx = this._findFreeWorker()
      if (freeIdx !== -1) {
        this._send(freeIdx, job)
      }
      else {
        // Insert into priority queue
        this._enqueue(job)
      }
    })
  }

  _enqueue(job) {
    // Insert maintaining priority order (lower priority number = higher priority)
    let inserted = false
    for (let i = 0; i < this._queue.length; i++) {
      if (job.priority < this._queue[i].priority) {
        this._queue.splice(i, 0, job)
        inserted = true
        break
      }
    }
    if (!inserted)
      this._queue.push(job)
  }

  _findFreeWorker() {
    for (let i = 0; i < this._workers.length; i++) {
      if (!this._busy.has(i))
        return i
    }
    return -1
  }

  _send(workerIdx, job) {
    this._busy.add(workerIdx)
    this._pending.set(job.id, { resolve: job.resolve, reject: job.reject, workerIdx })
    const msg = { id: job.id, type: job.type, payload: job.payload }
    if (job.transferables) {
      this._workers[workerIdx].postMessage(msg, job.transferables)
    }
    else {
      this._workers[workerIdx].postMessage(msg)
    }
  }

  _onMessage(workerIdx, e) {
    const { id, result, error } = e.data
    const entry = this._pending.get(id)
    if (!entry)
      return

    this._pending.delete(id)
    this._busy.delete(workerIdx)

    if (error) {
      entry.reject(new Error(error))
    }
    else {
      entry.resolve(result)
    }

    // Process next queued job
    this._processQueue()
  }

  _onError(workerIdx, e) {
    logger.error(`[WorkerPool] Worker ${workerIdx} error:`, e)
    this._busy.delete(workerIdx)
    this._processQueue()
  }

  _processQueue() {
    if (this._queue.length === 0)
      return
    const freeIdx = this._findFreeWorker()
    if (freeIdx === -1)
      return
    const job = this._queue.shift()
    this._send(freeIdx, job)
  }
}
