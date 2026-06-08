import { onBeforeUnmount, onMounted, ref } from 'vue'

export function useDarkMode() {
  const isDark = ref(typeof document !== 'undefined' && document.documentElement.classList.contains('dark'))
  let observer

  function syncDarkMode() {
    isDark.value = document.documentElement.classList.contains('dark')
  }

  function toggleDarkMode() {
    document.documentElement.classList.toggle('dark', !isDark.value)
    syncDarkMode()
  }

  onMounted(() => {
    syncDarkMode()

    observer = new MutationObserver(() => {
      syncDarkMode()
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  return {
    isDark,
    toggleDarkMode,
  }
}
