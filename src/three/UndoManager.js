import { useUndoStore } from '@/stores/useUndoStore'
import { logger } from '@/utils/logger'
import { createCompoundCommand } from './commands/index.js'

/**
 * UndoManager — manages undo/redo stacks with:
 *  - Fixed maxSteps (50)
 *  - Command merging within 300ms window
 *  - Async execution with Promise-based mutex
 *  - UUID-based purge for model deletion
 *  - Debounced GC trigger for snapshot store
 *  - Pinia store sync for UI reactivity
 */
export class UndoManager {
  /**
   * @param {object} opts
   * @param {GeometrySnapshotService} [opts.snapshotService]  for triggering GC
   * @param {number} [opts.maxSteps]  default 50
   * @param {number} [opts.mergeWindow]  ms window for command merging, default 300
   */
  constructor({ snapshotService = null, maxSteps = 50, mergeWindow = 300, onAfterUndoRedo = null } = {}) {
    this._undoStack = []
    this._redoStack = []
    this._isExecuting = false
    this._executionLock = null
    this._maxSteps = maxSteps
    this._mergeWindow = mergeWindow
    this._snapshotService = snapshotService
    this._gcTimer = null
    // Called after an undo or redo completes (e.g. to re-run collision detection).
    this._onAfterUndoRedo = onAfterUndoRedo

    // Transaction state
    this._transaction = null // { label, commands[] }

    // Store reference — lazily initialised on first _syncUI()
    this._store = null
  }

  // ------------- public API ------------------

  get canUndo() {
    return !this._isExecuting && this._undoStack.length > 0
  }

  get canRedo() {
    return !this._isExecuting && this._redoStack.length > 0
  }

  get undoLabel() {
    const cmd = this._undoStack[this._undoStack.length - 1]
    return cmd ? cmd.label : ''
  }

  get redoLabel() {
    const cmd = this._redoStack[this._redoStack.length - 1]
    return cmd ? cmd.label : ''
  }

  /**
   * Push a command onto the undo stack.
   * Clears redo stack. Enforces maxSteps. Triggers debounced GC.
   */
  push(cmd) {
    if (this._isExecuting)
      return

    // If inside a transaction, collect instead of pushing
    if (this._transaction) {
      this._transaction.commands.push(cmd)
      return
    }

    // Try merge with last command
    if (this._tryMerge(cmd)) {
      this._syncUI()
      return
    }

    this._undoStack.push(cmd)
    this._redoStack.length = 0

    // Enforce max steps — remove oldest
    while (this._undoStack.length > this._maxSteps) {
      this._undoStack.shift()
    }

    this._syncUI()
    this._scheduleSweep()
  }

  /**
   * Undo the last command. Async because geometry commands may need decoding.
   */
  async undo(abortSignal) {
    if (!this.canUndo)
      return
    await this._withLock(async () => {
      const cmd = this._undoStack.pop()
      try {
        await cmd.undo(abortSignal)
      }
      catch (err) {
        // Re-push on failure so state stays consistent
        this._undoStack.push(cmd)
        throw err
      }
      this._redoStack.push(cmd)
    })
    this._onAfterUndoRedo?.()
  }

  /**
   * Redo the last undone command.
   */
  async redo(abortSignal) {
    if (!this.canRedo)
      return
    await this._withLock(async () => {
      const cmd = this._redoStack.pop()
      try {
        await cmd.apply(abortSignal)
      }
      catch (err) {
        this._redoStack.push(cmd)
        throw err
      }
      this._undoStack.push(cmd)
    })
    this._onAfterUndoRedo?.()
  }

  /**
   * Remove all commands that reference a given model UUID.
   * Used when a model is permanently deleted.
   */
  purgeModel(uuid) {
    this._undoStack = this._undoStack.filter(cmd => !this._cmdReferencesModel(cmd, uuid))
    this._redoStack = this._redoStack.filter(cmd => !this._cmdReferencesModel(cmd, uuid))
    this._syncUI()
    this._scheduleSweep()
  }

  /** Clear all history. */
  clear() {
    this._undoStack.length = 0
    this._redoStack.length = 0
    this._syncUI()
  }

  // ------------- transactions ------------------

  /**
   * Begin collecting commands into a compound command.
   * @param {string} label
   */
  beginTransaction(label) {
    if (this._transaction) {
      logger.warn('[UndoManager] Transaction already in progress, nesting not supported.')
      return
    }
    this._transaction = { label, commands: [] }
  }

  /**
   * Commit the current transaction as a single compound command.
   */
  commitTransaction() {
    if (!this._transaction)
      return
    const { label, commands } = this._transaction
    this._transaction = null

    if (commands.length === 0)
      return
    if (commands.length === 1) {
      // Don't wrap a single command
      commands[0].label = label
      this.push(commands[0])
    }
    else {
      this.push(createCompoundCommand(label, commands))
    }
  }

  /**
   * Roll back the current transaction: undo all collected commands.
   */
  async rollbackTransaction() {
    if (!this._transaction)
      return
    const { commands } = this._transaction
    this._transaction = null
    // Undo collected commands in reverse
    for (let i = commands.length - 1; i >= 0; i--) {
      await commands[i].undo()
    }
  }

  // ------------- internals ------------------

  _tryMerge(cmd) {
    const last = this._undoStack[this._undoStack.length - 1]
    if (!last)
      return false
    if (typeof last.canMerge === 'function' && last.canMerge(cmd)) {
      last.merge(cmd)
      return true
    }
    return false
  }

  _cmdReferencesModel(cmd, uuid) {
    if (cmd.targetUuid === uuid)
      return true
    if (cmd.type === 'compound' && Array.isArray(cmd.subCommands)) {
      return cmd.subCommands.some(sub => this._cmdReferencesModel(sub, uuid))
    }
    return false
  }

  async _withLock(fn) {
    // Wait for any existing lock
    while (this._executionLock) {
      await this._executionLock
    }

    let resolve
    this._executionLock = new Promise(r => (resolve = r))
    this._isExecuting = true
    this._syncUI()

    try {
      await fn()
    }
    finally {
      this._isExecuting = false
      this._executionLock = null
      resolve()
      this._syncUI()
    }
  }

  _syncUI() {
    if (!this._store) {
      try {
        this._store = useUndoStore()
      }
      catch {
        return // Pinia not ready yet
      }
    }
    this._store.canUndo = this.canUndo
    this._store.canRedo = this.canRedo
    this._store.undoLabel = this.undoLabel
    this._store.redoLabel = this.redoLabel
    this._store.isExecuting = this._isExecuting
  }

  _scheduleSweep() {
    if (!this._snapshotService)
      return
    clearTimeout(this._gcTimer)
    this._gcTimer = setTimeout(() => {
      this._runSweep()
    }, 3000)
  }

  _runSweep() {
    if (!this._snapshotService)
      return
    // Collect all geometry refs still referenced by undo/redo stacks
    const referencedHashes = new Set()
    const collectFromCmd = (cmd) => {
      if (cmd.type === 'compound' && Array.isArray(cmd.subCommands)) {
        cmd.subCommands.forEach(collectFromCmd)
      }
      // Geometry commands store refs in closures — we can't easily introspect.
      // The snapshot service will handle this via its own tracking.
    }
    ;[...this._undoStack, ...this._redoStack].forEach(collectFromCmd)
    this._snapshotService.sweep(referencedHashes)
  }

  /** Dispose resources. */
  dispose() {
    clearTimeout(this._gcTimer)
    this._undoStack.length = 0
    this._redoStack.length = 0
  }
}
