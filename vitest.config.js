import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Evaluate callback-form Vite config with test mode so Vitest does not inherit
// development-only plugins that can keep the process busy or delay collection.
const base = typeof viteConfig === 'function'
  ? await viteConfig({ mode: 'test' })
  : viteConfig

export default mergeConfig(
  base,
  defineConfig({
    test: {
      environment: 'jsdom',
      threads: false,
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
    },
  }),
)
