import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useGeneralStore = defineStore('general', () => {
  const allowModelLoading = ref(true)
  const controlMode = ref('drag')
  const viewMode = ref('normal')
  const showGizmo = ref(false)
  const debugMode = ref(false)
  const currentLanguage = ref('en')
  const availableLanguages = ref([
    { name: 'English', code: 'EN' },
    { name: 'Japanese', code: 'JP' },
    { name: 'Traditional Chinese', code: 'TW' },
    { name: 'Simplified Chinese', code: 'CN' },
  ])
  const checkScene = ref(false)

  function setDebugMode(enabled) {
    debugMode.value = Boolean(enabled)
  }

  return {
    allowModelLoading,
    currentLanguage,
    availableLanguages,
    controlMode,
    showGizmo,
    checkScene,
    viewMode,
    debugMode,
    setDebugMode,
  }
})
