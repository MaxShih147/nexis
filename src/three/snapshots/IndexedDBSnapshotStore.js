import { SnapshotStore } from './SnapshotStore.js'

const DB_NAME = 'undo-snapshots'
const DB_VERSION = 1
const BLOB_STORE = 'blobs'
const META_STORE = 'meta'

/**
 * IndexedDB-backed snapshot store for Phase 1 (local-first).
 *
 * Object stores:
 *   blobs — { hash (key), data: Uint8Array }
 *   meta  — { hash (key), codec, bytes, createdAt, lastAccess }
 */
export class IndexedDBSnapshotStore extends SnapshotStore {
  constructor() {
    super()
    this._db = null
    this._dbReady = this._open()
    this._totalBytes = 0
    this._totalBytesValid = false
  }

  async _open() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(BLOB_STORE)) {
          db.createObjectStore(BLOB_STORE, { keyPath: 'hash' })
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE, { keyPath: 'hash' })
        }
      }
      req.onsuccess = () => {
        this._db = req.result
        resolve(this._db)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async _getDB() {
    if (this._db)
      return this._db
    return this._dbReady
  }

  async put(hash, blob, meta) {
    const db = await this._getDB()
    const now = Date.now()
    const metaRecord = {
      hash,
      codec: meta.codec,
      bytes: blob.byteLength,
      createdAt: meta.createdAt || now,
      lastAccess: now,
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite')
      tx.objectStore(BLOB_STORE).put({ hash, data: blob })
      tx.objectStore(META_STORE).put(metaRecord)
      tx.oncomplete = () => {
        this._totalBytesValid = false
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async get(hash) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readonly')
      const blobReq = tx.objectStore(BLOB_STORE).get(hash)
      const metaReq = tx.objectStore(META_STORE).get(hash)
      tx.oncomplete = () => {
        if (!blobReq.result) {
          resolve(null)
          return
        }
        resolve({
          blob: blobReq.result.data,
          meta: metaReq.result || {},
        })
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async has(hash) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const req = tx.objectStore(META_STORE).count(hash)
      req.onsuccess = () => resolve(req.result > 0)
      req.onerror = () => reject(req.error)
    })
  }

  async del(hash) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction([BLOB_STORE, META_STORE], 'readwrite')
      tx.objectStore(BLOB_STORE).delete(hash)
      tx.objectStore(META_STORE).delete(hash)
      tx.oncomplete = () => {
        this._totalBytesValid = false
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async getMeta(hash) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const req = tx.objectStore(META_STORE).get(hash)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
  }

  async touch(hash) {
    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readwrite')
      const store = tx.objectStore(META_STORE)
      const req = store.get(hash)
      req.onsuccess = () => {
        if (req.result) {
          req.result.lastAccess = Date.now()
          store.put(req.result)
        }
        resolve()
      }
      tx.onerror = () => reject(tx.error)
    })
  }

  async getTotalBytes() {
    if (this._totalBytesValid)
      return this._totalBytes

    const db = await this._getDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const store = tx.objectStore(META_STORE)
      const req = store.openCursor()
      let total = 0
      req.onsuccess = () => {
        const cursor = req.result
        if (cursor) {
          total += cursor.value.bytes || 0
          cursor.continue()
        }
        else {
          this._totalBytes = total
          this._totalBytesValid = true
          resolve(total)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  async * iterateMeta() {
    const db = await this._getDB()
    const all = await new Promise((resolve, reject) => {
      const tx = db.transaction(META_STORE, 'readonly')
      const req = tx.objectStore(META_STORE).getAll()
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
    for (const meta of all) {
      yield { hash: meta.hash, meta }
    }
  }
}
