import { cpSync, existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import { defineConfig, loadEnv } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))

function copyDataPlugin() {
  return {
    name: 'copy-data-folder',
    apply: 'build',
    closeBundle() {
      const srcDir = resolve(projectRoot, 'src/data')
      const destDir = resolve(projectRoot, 'dist/data')
      if (!existsSync(srcDir)) {
        this.warn('[copy-data-folder] Source data directory not found, skipping copy.')
        return
      }
      try {
        rmSync(destDir, { recursive: true, force: true })
        cpSync(srcDir, destDir, { recursive: true })
      }
      catch (error) {
        this.error(`[copy-data-folder] Failed to copy data assets: ${error.message}`)
      }
    },
  }
}

export default defineConfig(({ mode } = { mode: 'development' }) => {
  const isTest = mode === 'test' || process.env.VITEST === 'true'
  const env = loadEnv(mode, projectRoot, '')
  const accountApiProxyTarget = (env.VITE_DB_API_ORIGIN?.startsWith('http') ? env.VITE_DB_API_ORIGIN : undefined)
    || (env.VITE_ACCOUNT_API_ORIGIN?.startsWith('http') ? env.VITE_ACCOUNT_API_ORIGIN : undefined)
  const accountApiProxy = accountApiProxyTarget
    ? {
        '/health': {
          target: accountApiProxyTarget,
          changeOrigin: true,
        },
        '/v1': {
          target: accountApiProxyTarget,
          changeOrigin: true,
        },
      }
    : {}

  return {
    plugins: [
      vue(),
      !isTest && vueDevTools(),
      VueI18nPlugin({
        include: [fileURLToPath(new URL('./src/i18n/locales/**', import.meta.url))],
      }),
      !isTest && Components({
        resolvers: [PrimeVueResolver()],
      }),
      copyDataPlugin(),
    ].filter(Boolean),
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      headers: {
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Opener-Policy': 'same-origin',
      },
      proxy: {
        '/api': {
          target: 'https://127.0.0.1:5179',
          changeOrigin: true,
          secure: false,
        },
        ...accountApiProxy,
      },
    },
  }
})
