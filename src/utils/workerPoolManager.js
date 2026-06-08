// WorkerPoolManager: 管理 Web Worker 池與任務佇列
import { logger } from '@/utils/logger'

export class WorkerPoolManager {
  /**
   * @param {Function} workerSource - worker 建構函數
   * @param {object} [options]
   * @param {number} [options.poolSize] - 最大同時 worker 數
   * @param {number} [options.taskTimeout] - 單一任務逾時(ms)
   */
  constructor(workerSource, { poolSize = 4, taskTimeout = 30000 } = {}) {
    const maxConcurrency = typeof navigator !== 'undefined' && navigator.hardwareConcurrency ? navigator.hardwareConcurrency : 8
    if (poolSize > maxConcurrency) {
      logger.warn(`[WorkerPoolManager] poolSize (${poolSize}) is larger than max concurrency (${maxConcurrency}). Adjusting to max concurrency.`)
      poolSize = maxConcurrency
    }
    this.WorkerSource = workerSource
    this.poolSize = poolSize
    this.taskTimeout = taskTimeout
    this.idleWorkers = []
    this.activeWorkers = new Set()
    this.taskQueue = []
    this.taskIdCounter = 0
  }

  /**
   * 加入任務到佇列，回傳 Promise
   * @param {any} payload - 傳給 worker 的資料
   * @returns {Promise<any>} worker 回傳結果
   */
  enqueueTask(payload) {
    return new Promise((resolve, reject) => {
      const task = {
        id: ++this.taskIdCounter,
        payload,
        resolve,
        reject,
        timeoutId: null,
      }
      this.taskQueue.push(task)
      this._processQueue()
    })
  }

  _processQueue() {
    while (this.taskQueue.length > 0 && (this.idleWorkers.length > 0 || this.activeWorkers.size < this.poolSize)) {
      const task = this.taskQueue.shift()
      let worker
      if (this.idleWorkers.length > 0) {
        worker = this.idleWorkers.pop()
      }
      else {
        worker = new this.WorkerSource()
      }
      this.activeWorkers.add(worker)
      let finished = false
      // 任務逾時處理
      task.timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true
          this._terminateWorker(worker)
          task.reject(new Error('Worker task timeout'))
          this._processQueue()
        }
      }, this.taskTimeout)
      worker.onmessage = (e) => {
        if (finished)
          return
        finished = true
        clearTimeout(task.timeoutId)
        this.activeWorkers.delete(worker)
        this.idleWorkers.push(worker)
        task.resolve(e.data)
        this._processQueue()
      }
      worker.onerror = (err) => {
        if (finished)
          return
        finished = true
        clearTimeout(task.timeoutId)
        this._terminateWorker(worker)
        task.reject(err)
        this._processQueue()
      }
      try {
        worker.postMessage(task.payload)
      }
      catch (err) {
        if (!finished) {
          finished = true
          clearTimeout(task.timeoutId)
          this._terminateWorker(worker)
          task.reject(err)
          this._processQueue()
        }
      }
    }
  }

  _terminateWorker(worker) {
    this.activeWorkers.delete(worker)
    try {
      worker.terminate()
    }
    catch {}
  }

  /**
   * 關閉所有 worker
   */
  terminateAll() {
    this.idleWorkers.forEach(w => w.terminate())
    this.activeWorkers.forEach(w => w.terminate())
    this.idleWorkers = []
    this.activeWorkers.clear()
  }
}
