// ============================================================
// 主色調設定 (Primary Color Theme)
// 修改此處以一鍵切換全站主色調
// ============================================================

// Tailwind CSS 色階 — 供 tailwind.config.js 使用，Vue 模板中可用 primary-* class
export const PRIMARY_PALETTE = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
  950: '#042f2e',
  DEFAULT: '#14b8a6',
}

// Three.js hex 格式 (0x 前綴) — 供 3D 場景使用
export const PRIMARY_HEX = {
  ACCENT: 0x14B8A6, // 主要 3D 強調色 (AxisHelper 邊框、場景、Hollow offset)
  PREVIEW: 0x14B8A6, // Ortho hex preview mesh (≈ teal-500)
  HIGHLIGHT: 0x0D9488, // 面選取高亮覆蓋 (≈ teal-600)
  ARROW: 0x5EEAD4, // 法線指示箭頭色 (≈ teal-300)
  EMISSIVE: 0x14B8A6, // 法線指示自發光色
}

// CSS 字串格式 — 供 SVG stroke 等非 Tailwind 情境使用
export const PRIMARY_CSS = {
  DEFAULT: '#14b8a6', // 外框 stroke (≈ teal-500)
  LIGHT: '#5eead4', // 內框 stroke (≈ teal-300)
}

// ============================================================
// 場景色彩常數
// ============================================================

// createBaseScene 基礎場景色彩
export const SCENE_COLORS = {
  DARK: 0x2D2E32,
  LIGHT: 0xFFFFFF,
  ACCENT: PRIMARY_HEX.ACCENT,
  GRID: 0x0F766E,
}

// MeshManager ortho preview 各類型色彩
export const ORTHO_PREVIEW_COLORS = {
  hollow: 0x22C55E,
  hex: PRIMARY_HEX.PREVIEW,
  drain: 0xEAB308,
  sidewall: 0x0EA5E9,
}
