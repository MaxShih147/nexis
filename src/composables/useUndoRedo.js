import { useUndoStore } from '@/stores/useUndoStore'
import { onMounted, onUnmounted } from 'vue'

const isMacOS = (() => {
  const userAgentDataPlatform = navigator?.userAgentData?.platform?.toLowerCase?.() || ''
  const userAgent = navigator?.userAgent?.toLowerCase?.() || ''

  return userAgentDataPlatform.includes('mac') || userAgent.includes('mac')
})()

/**
 * Composable that binds Cmd+Z / Cmd+Shift+Z (or Ctrl on non-Mac)
 * to the UndoManager exposed by the scene coordinator.
 *
 * @param {() => import('../three/UndoManager').UndoManager | null} getUndoManager
 *   Getter function — the undo manager may not exist at setup time.
 * @returns {import('pinia').StoreGeneric}  reactive undo store for UI binding
 */
export function useUndoRedo(getUndoManager) {
  const undoStore = useUndoStore()

  function handleKeydown(e) {
    const undoManager = typeof getUndoManager === 'function' ? getUndoManager() : getUndoManager
    if (!undoManager)
      return

    // Don't intercept when an input/textarea has focus
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      return

    if (typeof e.key !== 'string')
      return

    const key = e.key.toLowerCase()
    const isUndo = isMacOS
      ? e.metaKey && !e.ctrlKey && !e.shiftKey && key === 'z'
      : e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'z'
    const isRedo = isMacOS
      ? e.metaKey && !e.ctrlKey && e.shiftKey && key === 'z'
      : e.ctrlKey && !e.metaKey && (
        (!e.shiftKey && key === 'y')
        || (e.shiftKey && key === 'z')
      )

    if (!isUndo && !isRedo)
      return

    e.preventDefault()

    if (isRedo) {
      undoManager.redo()
    }
    else {
      undoManager.undo()
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown))

  return undoStore
}
