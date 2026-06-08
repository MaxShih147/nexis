export const DEFAULT_DENTAL_MODE = 'Dental Model'

export const ORTHO_MODES = [
  DEFAULT_DENTAL_MODE,
  // 'Study Model',
  'C&B',
  'Splint',
  'Surgical Guide',
  // 'Denture Base',
  // 'Gingiva',
  // 'Tray',
  // 'Casting',
  // 'All on X',
]

const ORTHO_MODE_SET = new Set(ORTHO_MODES)
const LEGACY_DENTAL_MODE_ALIASES = {
  'Orthodontic Model': DEFAULT_DENTAL_MODE,
}

export function normalizeDentalModeLabel(value) {
  if (typeof value !== 'string')
    return value
  const trimmed = value.trim()
  return LEGACY_DENTAL_MODE_ALIASES[trimmed] ?? trimmed
}

export function isOrthoMode(value) {
  const normalized = normalizeDentalModeLabel(value)
  return typeof normalized === 'string' && ORTHO_MODE_SET.has(normalized)
}

export const ORIENTATION_MODES = {
  DENTAL_MODEL: 0,
  ORTHODONTIC_MODEL: 0,
  SPLINT: 1,
  SURGICAL_GUIDE: 2,
  C_AND_B: 3,
}

export function getOrientationModeKey(value) {
  const normalizedLabel = normalizeDentalModeLabel(value)
  return (typeof normalizedLabel === 'string')
    ? normalizedLabel.toUpperCase().replace(/ /g, '_').replace('&', '_AND_')
    : null
}

export function isOrientationMode(value) {
  const normalized = getOrientationModeKey(value)
  return Object.keys(ORIENTATION_MODES).includes(normalized)
}
