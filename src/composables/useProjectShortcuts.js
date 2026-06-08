import { onMounted, onUnmounted } from 'vue'

/**
 * Composable that binds Cmd+S / Cmd+O / Cmd+N (or Ctrl on non-Mac)
 * to project save / open / new operations.
 *
 * @param {() => import('../three/project/ProjectManager').ProjectManager | null} getProjectManager
 *   Getter function — the project manager may not exist at setup time.
 */
export function useProjectShortcuts(getProjectManager) {
  function handleKeydown(e) {
    const pm = typeof getProjectManager === 'function' ? getProjectManager() : getProjectManager
    if (!pm)
      return

    const isMeta = e.metaKey || e.ctrlKey
    if (!isMeta)
      return

    // Don't intercept when an input/textarea has focus
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      return

    if (typeof e.key !== 'string')
      return

    switch (e.key.toLowerCase()) {
      case 's':
        e.preventDefault()
        pm.save()
        break
      case 'o':
        e.preventDefault()
        pm.open()
        break
    }
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
}
