import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import DialogService from 'primevue/dialogservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import { createApp } from 'vue'
import App from './App.vue'
import { Noir } from './assets/themePreset'
import i18n from './i18n'
import Trans from './i18n/translation'
import router from './router'
import { useAuthStore } from './stores/useAuthStore'
import './assets/main.css'

async function bootstrap() {
  document.documentElement.classList.add('dark')

  const locale = Trans.guessDefaultLocale()
  await Trans.switchLanguage(locale)

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(router)
  app.use(i18n)
  app.use(PrimeVue, {
    ripple: true,
    theme: {
      preset: Noir,
      options: {
        darkModeSelector: '.dark',
      },
    },
    pt: {
      tooltip: {
        text: { style: { fontSize: '8px' } },
      },
    },
  })

  app.use(DialogService)
  app.use(ToastService)
  app.directive('tooltip', Tooltip)

  const authStore = useAuthStore(pinia)
  authStore.initialize()

  app.mount('#app')
}

bootstrap()
