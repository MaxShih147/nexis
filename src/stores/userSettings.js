// user settings
import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'

export const useSettingsStore = defineStore('settings', () => {
  // Load settings from localStorage or use defaults
  const savedSettings = localStorage.getItem('userSettings')
  const userSettings = reactive(
    savedSettings
      ? JSON.parse(savedSettings)
      : {
          flattenModelOnLoad: {
            title: 'features.settings.flattenModelOnLoad.title',
            description: 'features.settings.flattenModelOnLoad.description',
            value: false,
          },
          keepModelOnPlatform: {
            title: 'features.settings.keepModelOnPlatform.title',
            description: 'features.settings.keepModelOnPlatform.description',
            value: false,
          },
          setting3: {
            title: 'features.settings.futureSetting.title',
            description: 'features.settings.futureSetting.description',
            value: false,
          },
          setting4: {
            title: 'features.settings.futureSetting.title',
            description: 'features.settings.futureSetting.description',
            value: false,
          },
          setting5: {
            title: 'features.settings.futureSetting.title',
            description: 'features.settings.futureSetting.description',
            value: false,
          },
        },
  )

  // Watch for changes and save to localStorage
  watch(
    userSettings,
    (newSettings) => {
      localStorage.setItem('userSettings', JSON.stringify(newSettings))
    },
    { deep: true },
  )

  return { userSettings }
})
