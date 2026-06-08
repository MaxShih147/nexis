/**
 * SnapshotStore — abstract interface for compressed geometry blob storage.
 *
 * Implementations:
 *   - IndexedDBSnapshotStore  (Phase 1, local)
 *   - HttpSnapshotStore       (Phase 2, Mac Studio cache)
 *
 * All operations are idempotent.
 */

export class SnapshotStore {
  /**
   * Store a compressed blob under the given content hash.
   * @param {string} _hash  content-addressed key (SHA-256 hex)
   * @param {Uint8Array} _blob  compressed data
   * @param {object} _meta  { codec, bytes, createdAt, ... }
   */
  async put(_hash, _blob, _meta) { throw new Error('not implemented') }

  /**
   * Retrieve a stored blob.
   * @param {string} _hash
   */
  async get(_hash) { throw new Error('not implemented') }

  /**
   * Check existence.
   * @param {string} _hash
   */
  async has(_hash) { throw new Error('not implemented') }

  /**
   * Delete a blob.
   * @param {string} _hash
   */
  async del(_hash) { throw new Error('not implemented') }

  /**
   * Get metadata only (no blob transfer).
   * @param {string} _hash
   */
  async getMeta(_hash) { throw new Error('not implemented') }

  /**
   * Update lastAccess timestamp.
   * @param {string} _hash
   */
  async touch(_hash) { throw new Error('not implemented') }

  /**
   * Get total bytes stored.
   */
  async getTotalBytes() { throw new Error('not implemented') }

  /**
   * Iterate all metadata entries.
   */
  async * iterateMeta() { throw new Error('not implemented') }
}
