// Adapters: fromDefault(json)→UI, fromResin(json)→UI, toEngineDefault(ui)→default
import seedDefault from '../data/default_profiles/sonic_ls_plus.json'
import {
  ANTI_ALIASING_ENABLE_DEFAULT,
  ANTI_ALIASING_LEVEL_UI_DEFAULT,
  defaultToUi,
  IMAGE_BLUR_ENABLE_DEFAULT,
  IMAGE_BLUR_PIXEL_DEFAULT,
  mappingUtils,
  resinToUi,
  uiToDefault,
} from './mappingTables'

const { getByPath } = mappingUtils

function applyMap(source, map) {
  const out = {}
  for (const item of map) {
    const raw = getByPath(source, item.from)
    const val = item.transform ? item.transform(raw) : raw
    if (val === undefined || val === null || val === '')
      continue
    // set deep
    const parts = String(item.to).split('.')
    let cur = out
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i]
      cur[p] = cur[p] || {}
      cur = cur[p]
    }
    cur[parts[parts.length - 1]] = val
  }
  return out
}

export function fromDefault(defaultJson) {
  return applyMap(defaultJson || {}, defaultToUi)
}

export function fromResin(resinJson) {
  return applyMap(resinJson || {}, resinToUi)
}

// Seeded UI defaults using values from sonic_ls_plus.json (mapped via default→UI)
export const seededUiDefaults = (() => {
  const ui = fromDefault(seedDefault)
  return {
    schemaVersion: 1,
    machine: {
      name: ui?.machine?.name || 'Unknown',
      type: ui?.machine?.type,
      resolution: { x: ui?.machine?.resolution?.x || 0, y: ui?.machine?.resolution?.y || 0 },
      zHeight: ui?.machine?.zHeight || 0,
      mirror: ui?.machine?.mirror ?? false,
      bedSize: ui?.machine?.bedSize,
      margin: ui?.machine?.margin,
    },
    print: {
      layerHeight: ui?.print?.layerHeight || 0.05,
      exposure: ui?.print?.exposure || 2.5,
      bottom: {
        layers: ui?.print?.bottom?.layers || 5,
        exposure: ui?.print?.bottom?.exposure || 35,
      },
      lightOffDelay: ui?.print?.lightOffDelay,
      transition: ui?.print?.transition,
      restBeforeLift: ui?.print?.restBeforeLift,
      restAfterLift: ui?.print?.restAfterLift,
    },
    motion: {
      bottom: {
        liftHeight: ui?.motion?.bottom?.liftHeight || 6,
        liftSpeed: ui?.motion?.bottom?.liftSpeed || 60, // mm/min
        retractSpeed: ui?.motion?.bottom?.retractSpeed || 150, // mm/min
        retractDistance: ui?.motion?.bottom?.retractDistance,
        liftSecondDistance: ui?.motion?.bottom?.liftSecondDistance,
        liftSecondSpeed: ui?.motion?.bottom?.liftSecondSpeed,
        retractSecondDistance: ui?.motion?.bottom?.retractSecondDistance,
        retractSecondSpeed: ui?.motion?.bottom?.retractSecondSpeed,
      },
      normal: {
        liftHeight: ui?.motion?.normal?.liftHeight || 6,
        liftSpeed: ui?.motion?.normal?.liftSpeed || 60, // mm/min
        retractSpeed: ui?.motion?.normal?.retractSpeed || 150, // mm/min
        retractDistance: ui?.motion?.normal?.retractDistance,
        liftSecondDistance: ui?.motion?.normal?.liftSecondDistance,
        liftSecondSpeed: ui?.motion?.normal?.liftSecondSpeed,
        retractSecondDistance: ui?.motion?.normal?.retractSecondDistance,
        retractSecondSpeed: ui?.motion?.normal?.retractSecondSpeed,
      },
    },
    gcode: ui?.gcode,
    advanced: {
      ...ui?.advanced,
      antialiasing: ANTI_ALIASING_ENABLE_DEFAULT,
      antialiasingLevel: ANTI_ALIASING_LEVEL_UI_DEFAULT,
      imageBlurEnable: IMAGE_BLUR_ENABLE_DEFAULT,
      imageBlurPixel: IMAGE_BLUR_PIXEL_DEFAULT,
    },
  }
})()

// Convert UI back to engine default-structure using UI→default mapping
export function toEngineDefault(ui) {
  // Start from the seeded default JSON so we preserve full structure/keys
  const out = JSON.parse(JSON.stringify(seedDefault))
  for (const item of uiToDefault) {
    // read
    const val = getByPath(ui, item.from)
    if (val === undefined)
      continue
    const v = item.transform ? item.transform(val) : val
    if (v === undefined)
      continue
    // set into out using to path (support array indices like image_size[0])
    const parts = String(item.to).split('.')
    let cur = out
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const isLast = i === parts.length - 1
      if (p.endsWith(']')) {
        const [key, idxStr] = p.split('[')
        const idx = Number(idxStr.slice(0, -1))
        cur[key] = Array.isArray(cur[key]) ? cur[key] : []
        if (isLast) {
          cur[key][idx] = v
        }
        else {
          cur[key][idx] = cur[key][idx] || {}
          cur = cur[key][idx]
        }
      }
      else {
        if (isLast) {
          cur[p] = v
        }
        else {
          cur[p] = cur[p] || {}
          cur = cur[p]
        }
      }
    }
  }
  return out
}

// Naming alias for clarity at call sites (UI -> default/mechado config).
export const uiToDefaultConfig = toEngineDefault

// Stable default API object for call sites that prefer one import shape.
const adaptersApi = {
  fromDefault,
  fromResin,
  seededUiDefaults,
  toEngineDefault,
  uiToDefaultConfig,
}

export default adaptersApi
