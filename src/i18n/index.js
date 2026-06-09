import messages from '@intlify/unplugin-vue-i18n/messages'
import { createI18n } from 'vue-i18n'

export default createI18n({
  legacy: false, // must set to `false` to use Composition API
  locale: import.meta.env.VITE_DEFAULT_LOCALE || 'tw',
  fallbackLocale: import.meta.env.VITE_DEFAULT_LOCALE || 'tw',
  messages,
})
