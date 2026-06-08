import { onMounted, onUnmounted } from 'vue'

const isMacOS = (() => {
  const userAgentDataPlatform = navigator?.userAgentData?.platform?.toLowerCase?.() || ''
  const userAgent = navigator?.userAgent?.toLowerCase?.() || ''

  return userAgentDataPlatform.includes('mac') || userAgent.includes('mac')
})()

/**
 * Composable that binds Cmd+A / Ctrl+A to "select all models" on the scene
 * coordinator. No-op while a text field has focus (so it doesn't hijack the
 * browser's native select-all in inputs).
 *
 * @param {() => object | null} getThree
 *   Getter for the scene coordinator facade (may not exist at setup time).
 */
export function useMultiSelect(getThree) {
  function handleKeydown(e) {
    const three = typeof getThree === 'function' ? getThree() : getThree
    if (!three || typeof three.selectAllModels !== 'function')
      return

    // Don't intercept when an input/textarea/select has focus
    const tag = document.activeElement?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      return

    if (typeof e.key !== 'string')
      return

    const key = e.key.toLowerCase()
    const isSelectAll = isMacOS
      ? e.metaKey && !e.ctrlKey && !e.shiftKey && key === 'a'
      : e.ctrlKey && !e.metaKey && !e.shiftKey && key === 'a'

    if (!isSelectAll)
      return

    e.preventDefault()
    three.selectAllModels()
  }

  onMounted(() => document.addEventListener('keydown', handleKeydown))
  onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
}
