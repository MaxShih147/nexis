import messages from '@intlify/unplugin-vue-i18n/messages'
import { createI18n } from 'vue-i18n'

export default createI18n({
  legacy: false, // must set to `false` to use Composition API
  locale: import.meta.env.VITE_DEFAULT_LOCALE || 'en',
  fallbackLocale: import.meta.env.VITE_DEFAULT_LOCALE || 'en',
  messages,
})
