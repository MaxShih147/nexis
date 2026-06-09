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
import './assets/main.css'

// nexis is a desktop-grade WebGL tool; the full 3D scene exceeds mobile Safari's
// memory budget and crashes the tab. On phones we skip mounting the app entirely
// (so WebGL never initializes) and show a "use a desktop" notice instead.
function isPhone() {
  const ua = navigator.userAgent || ''
  const uaPhone = /Android|iPhone|iPod|Windows Phone|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)
  const narrowTouch = (navigator.maxTouchPoints || 0) > 0
    && window.matchMedia('(max-width: 768px)').matches
  return uaPhone || narrowTouch
}

function showMobileNotice() {
  const el = document.getElementById('app')
  if (!el)
    return
  el.innerHTML = `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e7eb;font-family:system-ui,-apple-system,'PingFang TC','Noto Sans TC',sans-serif;padding:24px;text-align:center">
      <div style="max-width:360px">
        <div style="font-size:13px;letter-spacing:.35em;color:#14b8a6;font-weight:700;margin-bottom:20px">NEXIS</div>
        <div style="font-size:44px;margin-bottom:18px">🖥️</div>
        <h1 style="font-size:20px;font-weight:700;margin:0 0 14px">手機版開發中（TBD）</h1>
        <p style="font-size:14px;line-height:1.8;color:#9ca3af;margin:0">
          nexis 是桌面端的 3D 碰撞／干涉檢測工具，<br>行動裝置版本尚在規劃中。<br><br>
          請改用<strong style="color:#e5e7eb">電腦瀏覽器</strong>開啟。
        </p>
        <p style="font-size:11px;color:#4b5563;margin-top:24px">Mobile version is a work in progress — please open on a desktop browser.</p>
      </div>
    </div>`
}

async function bootstrap() {
  document.documentElement.classList.add('dark')

  if (isPhone()) {
    showMobileNotice()
    return
  }

  // nexis: fixed to Traditional Chinese (the locale switcher is hidden).
  await Trans.switchLanguage('tw')

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

  app.mount('#app')
}

bootstrap()
