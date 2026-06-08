// Declarative mapping tables and small transforms
// Maps: default→UI, resin→UI, UI→default

// UI display values (stored in uiParams). Backend/Mechado/Prusa use separate indices — see transforms below.

/** Anti-aliasing: UI shows 2x/4x/8x multipliers; backend anti_aliasing_level is 0/1/2. */
export const AA_UI_LEVELS = [2, 4, 8]

// AA / blur UI defaults: profile-agnostic, application-level constants.
// These are the single source of truth for all four AA/blur default values.
// seededUiDefaults (adapters.js) and FIELD_DEFS (uiSchema.js) both consume these
// so that every machine and resin resolves to the same starting state.
// AA/blur are intentionally NOT read from machine profiles (defaultToUi omits them)
// so the default layer can never override these values.
export const ANTI_ALIASING_ENABLE_DEFAULT = false
export const ANTI_ALIASING_LEVEL_UI_DEFAULT = 4

/** Blur pixel: UI select 2–8 ↔ profile/Mechado 1–7. Image Blur bool stored separately. */
export const BLUR_UI_LEVELS = [2, 3, 4, 5, 6, 7, 8]
export const BLUR_UI_MIN = 2
export const BLUR_UI_MAX = 8
export const IMAGE_BLUR_ENABLE_DEFAULT = false
export const IMAGE_BLUR_PIXEL_DEFAULT = 2

/** Profile/API 0|1|2 → UI multiplier 2|4|8 (same convention as mmPerMinToMmPerSec). */
function antiAliasingLevelBackendToUi(backend) {
  const n = Number(backend)
  if (!Number.isFinite(n))
    return undefined
  if (n >= 0 && n < AA_UI_LEVELS.length)
    return AA_UI_LEVELS[n]
  // Tolerate an already-converted UI value (defensive against double-conversion).
  if (AA_UI_LEVELS.includes(n))
    return n
  return undefined
}

/** UI multiplier 2|4|8 → profile/API 0|1|2. */
function antiAliasingLevelUiToBackend(ui) {
  const i = AA_UI_LEVELS.indexOf(Number(ui))
  return i === -1 ? undefined : i
}

/** Profile/API blur 1–7 (or 0) → UI display pixel 2–8. */
function imageBlurPixelBackendToUi(backend) {
  const n = Number(backend)
  if (!Number.isFinite(n))
    return undefined
  if (n === 0)
    return BLUR_UI_MIN
  const ui = n + 1
  if (ui < BLUR_UI_MIN)
    return BLUR_UI_MIN
  if (ui > BLUR_UI_MAX)
    return BLUR_UI_MAX
  return ui
}

/** UI display pixel 2–8 → profile/API blur 1–7. */
function imageBlurPixelUiToBackend(ui) {
  const n = Number(ui)
  if (!Number.isFinite(n))
    return undefined
  const backend = n - 1
  if (backend < 1)
    return 1
  if (backend > 7)
    return 7
  return backend
}

// Unit transforms
export const transforms = {
  id: v => v,
  toNumber: v => (v === '' || v == null ? undefined : Number(v)),
  toBoolean: v => (v === 'true' ? true : v === 'false' ? false : !!v),
  boolToInt: v => (v ? 1 : 0),
  mmPerMinToMmPerSec: v => (typeof v === 'number' ? v / 60 : undefined),
  mmPerSecToMmPerMin: v => (typeof v === 'number' ? v * 60 : undefined),
  antiAliasingLevelBackendToUi,
  antiAliasingLevelUiToBackend,
  imageBlurPixelBackendToUi,
  imageBlurPixelUiToBackend,
}

// Helper to read deep value by path or accessor function
function getByPath(obj, path) {
  if (typeof path === 'function')
    return path(obj)
  const parts = Array.isArray(path) ? path : String(path).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null)
      return undefined
    if (p.endsWith(']')) {
      // array index like image_size[0]
      const [key, idxStr] = p.split('[')
      const idx = Number(idxStr.slice(0, -1))
      cur = cur?.[key]?.[idx]
    }
    else {
      cur = cur?.[p]
    }
  }
  return cur
}

// Helper to set deep value by path
function setByPath(obj, path, value) {
  const parts = String(path).split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    cur[p] = cur[p] || {}
    cur = cur[p]
  }
  cur[parts[parts.length - 1]] = value
}

// Resin selection utility: pick first mode for a given thickness (default 0.05) and mode 'stable'
export function pickResinMode(resinJson, thickness = 0.05, modeName = 'stable') {
  const profiles = resinJson?.profiles || []
  // choose first profile that has the requested thickness
  for (const p of profiles) {
    const cfgs = p?.thickness_configs || []
    const cfg = cfgs.find(c => Math.abs((c?.thickness_mm ?? -1) - thickness) < 1e-6)
    if (!cfg)
      continue
    const m = (cfg?.modes || []).find(m => m?.mode === modeName) || (cfg?.modes || [])[0]
    if (m)
      return { profile: p, cfg, mode: m }
  }
  return null
}

// Declarative map items: { from: <path|fn>, to: <ui path>, transform?: fn }
export const defaultToUi = [
  { from: 'Machine.Machine Name', to: 'machine.name' },
  { from: 'Machine.machine_type', to: 'machine.type' },
  { from: 'Machine.image_size[0]', to: 'machine.resolution.x' },
  { from: 'Machine.image_size[1]', to: 'machine.resolution.y' },
  { from: 'Machine.machine_z', to: 'machine.zHeight', transform: transforms.toNumber },
  { from: 'Machine.bed_size[2]', to: 'machine.bedSize.x', transform: transforms.toNumber },
  { from: 'Machine.bed_size[3]', to: 'machine.bedSize.y', transform: transforms.toNumber },
  { from: 'Machine.Mirror', to: 'machine.mirror', transform: transforms.toBoolean },

  { from: 'Print.Layer Height', to: 'print.layerHeight', transform: transforms.toNumber },
  { from: 'Print.Bottom Layer Count', to: 'print.bottom.layers', transform: transforms.toNumber },
  { from: 'Print.Bottom Exposure Time', to: 'print.bottom.exposure', transform: transforms.toNumber },
  { from: 'Print.Exposure Time', to: 'print.exposure', transform: transforms.toNumber },
  { from: 'Print.Rest After Retract', to: 'print.lightOffDelay', transform: transforms.toNumber },
  { from: 'Print.Transition Layer Count', to: 'print.transition.count', transform: transforms.toNumber },
  { from: 'Print.Rest Before Lift', to: 'print.restBeforeLift', transform: transforms.toNumber },
  { from: 'Print.Rest After Lift', to: 'print.restAfterLift', transform: transforms.toNumber },

  { from: 'Print.Bottom Lifting Distance', to: 'motion.bottom.liftHeight', transform: transforms.toNumber },
  { from: 'Print.Bottom Retract Second Distance', to: 'motion.bottom.retractDistance', transform: transforms.toNumber },
  { from: 'Print.Lifting Distance', to: 'motion.normal.liftHeight', transform: transforms.toNumber },
  { from: 'Print.Retract Second Distance', to: 'motion.normal.retractDistance', transform: transforms.toNumber },

  { from: 'Print.Bottom Lifting Speed', to: 'motion.bottom.liftSpeed', transform: transforms.toNumber },
  { from: 'Print.Lifting Speed', to: 'motion.normal.liftSpeed', transform: transforms.toNumber },
  { from: 'Print.Bottom Retract Speed', to: 'motion.bottom.retractSpeed', transform: transforms.toNumber },
  { from: 'Print.Normal Retract Speed', to: 'motion.normal.retractSpeed', transform: transforms.toNumber },
  { from: 'Print.Bottom Lifting Second Distance', to: 'motion.bottom.liftSecondDistance', transform: transforms.toNumber },
  { from: 'Print.Bottom Lifting Second Speed', to: 'motion.bottom.liftSecondSpeed', transform: transforms.toNumber },
  { from: 'Print.Bottom Retract Second Speed', to: 'motion.bottom.retractSecondSpeed', transform: transforms.toNumber },
  { from: 'Print.Lifting Second Distance', to: 'motion.normal.liftSecondDistance', transform: transforms.toNumber },
  { from: 'Print.Lifting Second Speed', to: 'motion.normal.liftSecondSpeed', transform: transforms.toNumber },
  { from: 'Print.Normal Retract Second Speed', to: 'motion.normal.retractSecondSpeed', transform: transforms.toNumber },

  { from: 'Gcode.Start', to: 'gcode.start' },
  { from: 'Gcode.Interlayer', to: 'gcode.mid' },
  { from: 'Gcode.End', to: 'gcode.end' },

  { from: 'Advanced.Light PWM', to: 'advanced.lightPWM', transform: transforms.toNumber },
  { from: 'Advanced.Bottom Light PWM', to: 'advanced.bottomLightPWM', transform: transforms.toNumber },
  { from: 'Advanced.Grey Level', to: 'advanced.greyLevel', transform: transforms.toNumber },
  // AA/blur intentionally omitted: profile values are not read into UI.
  // Defaults come from ANTI_ALIASING_ENABLE_DEFAULT / ANTI_ALIASING_LEVEL_UI_DEFAULT /
  // IMAGE_BLUR_ENABLE_DEFAULT / IMAGE_BLUR_PIXEL_DEFAULT via seededUiDefaults.
  { from: 'Advanced.Inner Compensate', to: 'advanced.innerCompensate', transform: transforms.toNumber },
  { from: 'Advanced.Outer Compensate', to: 'advanced.outerCompensate', transform: transforms.toNumber },
]

export const resinToUi = [
  // machine metadata
  // { from: r => r?.printer_name, to: 'machine.name' },
  // { from: r => r?.printer_brand, to: 'machine.type' },
  // { from: r => r?.resolution?.x, to: 'machine.resolution.x' },
  // { from: r => r?.resolution?.y, to: 'machine.resolution.y' },
  // { from: r => r?.dimensions?.z, to: 'machine.zHeight', transform: transforms.toNumber },
  // { from: r => r?.dimensions?.x, to: 'machine.bedSize.x', transform: transforms.toNumber },
  // { from: r => r?.dimensions?.y, to: 'machine.bedSize.y', transform: transforms.toNumber },
  // { from: r => r?.image_mirror, to: 'machine.mirror', transform: transforms.toNumber },
  // { from: r => r?.margin_buffer?.x, to: 'machine.margin', transform: transforms.toNumber }, // pick x

  // thickness + mode scoped fields (select 0.05mm stable by default)
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.cfg?.thickness_mm, to: 'print.layerHeight', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.profile?.resin_name, to: 'resin.name' },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.base_layers, to: 'print.bottom.layers', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.base_curing_time, to: 'print.bottom.exposure', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_curing_time, to: 'print.exposure', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_wait_before_print, to: 'print.lightOffDelay', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_wait_after_print, to: 'print.restBeforeLift', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_wait_lift, to: 'print.restAfterLift', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.buffer_layer_number, to: 'print.transition.count', transform: transforms.toNumber },

  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.base_lift_height, to: 'motion.bottom.liftHeight', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.bottom_retract_second_dist, to: 'motion.bottom.retractDistance', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_lift_height, to: 'motion.normal.liftHeight', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.retract_second_dist, to: 'motion.normal.retractDistance', transform: transforms.toNumber },

  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.base_peel_speed, to: 'motion.bottom.liftSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_peel_speed, to: 'motion.normal.liftSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.base_return_speed, to: 'motion.bottom.retractSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.normal_return_speed, to: 'motion.normal.retractSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.bottom_lift_second_dist, to: 'motion.bottom.liftSecondDistance', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.bottom_lift_second_speed, to: 'motion.bottom.liftSecondSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.bottom_retract_second_speed, to: 'motion.bottom.retractSecondSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.lift_second_dist, to: 'motion.normal.liftSecondDistance', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.lift_second_speed, to: 'motion.normal.liftSecondSpeed', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.retract_second_speed, to: 'motion.normal.retractSecondSpeed', transform: transforms.toNumber },

  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.light_pwm, to: 'advanced.lightPWM', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.bottom_light_pwm, to: 'advanced.bottomLightPWM', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.grayscale_level, to: 'advanced.greyLevel', transform: transforms.toNumber },

  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.gcode?.start, to: 'gcode.start' },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.gcode?.mid, to: 'gcode.mid' },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.gcode?.end, to: 'gcode.end' },

  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.compensate_size?.default?.in, to: 'advanced.innerCompensate', transform: transforms.toNumber },
  { from: r => pickResinMode(r, r?.__selected_thickness ?? 0.05, r?.__selected_mode ?? 'stable')?.mode?.compensate_size?.default?.out, to: 'advanced.outerCompensate', transform: transforms.toNumber },
]

export const uiToDefault = [
  { from: 'machine.name', to: 'Machine.Machine Name' },
  { from: 'machine.type', to: 'Machine.machine_type' },
  { from: 'machine.resolution.x', to: 'Machine.image_size[0]' },
  { from: 'machine.resolution.y', to: 'Machine.image_size[1]' },
  { from: 'machine.zHeight', to: 'Machine.machine_z', transform: transforms.toNumber },
  { from: 'machine.bedSize.x', to: 'Machine.bed_size[2]', transform: transforms.toNumber },
  { from: 'machine.bedSize.y', to: 'Machine.bed_size[3]', transform: transforms.toNumber },
  { from: 'machine.mirror', to: 'Machine.Mirror', transform: transforms.toNumber },
  // { from: 'machine.mirror', to: 'Machine.Mirror', transform: transforms.toNumber },

  { from: 'print.layerHeight', to: 'Print.Layer Height', transform: transforms.toNumber },
  { from: 'print.bottom.layers', to: 'Print.Bottom Layer Count', transform: transforms.toNumber },
  { from: 'print.bottom.exposure', to: 'Print.Bottom Exposure Time', transform: transforms.toNumber },
  { from: 'print.exposure', to: 'Print.Exposure Time', transform: transforms.toNumber },
  { from: 'print.lightOffDelay', to: 'Print.Rest After Retract', transform: transforms.toNumber },
  { from: 'print.lightOffDelay', to: 'Print.Bottom Rest After Retract', transform: transforms.toNumber },
  { from: 'print.transition.count', to: 'Print.Transition Layer Count', transform: transforms.toNumber },
  { from: 'print.restBeforeLift', to: 'Print.Rest Before Lift', transform: transforms.toNumber },
  { from: 'print.restBeforeLift', to: 'Print.Bottom Rest Before Lift', transform: transforms.toNumber },
  { from: 'print.restAfterLift', to: 'Print.Rest After Lift', transform: transforms.toNumber },
  { from: 'print.restAfterLift', to: 'Print.Bottom Rest After Lift', transform: transforms.toNumber },

  { from: 'motion.bottom.liftHeight', to: 'Print.Bottom Lifting Distance', transform: transforms.toNumber },
  { from: 'motion.bottom.retractDistance', to: 'Print.Bottom Retract Second Distance', transform: transforms.toNumber },
  { from: 'motion.normal.liftHeight', to: 'Print.Lifting Distance', transform: transforms.toNumber },
  { from: 'motion.normal.retractDistance', to: 'Print.Retract Second Distance', transform: transforms.toNumber },

  { from: 'motion.bottom.liftSpeed', to: 'Print.Bottom Lifting Speed', transform: transforms.toNumber },
  { from: 'motion.normal.liftSpeed', to: 'Print.Lifting Speed', transform: transforms.toNumber },
  { from: 'motion.bottom.retractSpeed', to: 'Print.Bottom Retract Speed', transform: transforms.toNumber },
  { from: 'motion.normal.retractSpeed', to: 'Print.Normal Retract Speed', transform: transforms.toNumber },
  { from: 'motion.bottom.liftSecondDistance', to: 'Print.Bottom Lifting Second Distance', transform: transforms.toNumber },
  { from: 'motion.bottom.liftSecondSpeed', to: 'Print.Bottom Lifting Second Speed', transform: transforms.toNumber },
  { from: 'motion.bottom.retractSecondSpeed', to: 'Print.Bottom Retract Second Speed', transform: transforms.toNumber },
  { from: 'motion.normal.liftSecondDistance', to: 'Print.Lifting Second Distance', transform: transforms.toNumber },
  { from: 'motion.normal.liftSecondSpeed', to: 'Print.Lifting Second Speed', transform: transforms.toNumber },
  { from: 'motion.normal.retractSecondSpeed', to: 'Print.Normal Retract Second Speed', transform: transforms.toNumber },

  { from: 'gcode.start', to: 'Gcode.Start' },
  { from: 'gcode.mid', to: 'Gcode.Interlayer' },
  { from: 'gcode.end', to: 'Gcode.End' },

  { from: 'advanced.lightPWM', to: 'Advanced.Light PWM', transform: transforms.toNumber },
  { from: 'advanced.bottomLightPWM', to: 'Advanced.Bottom Light PWM', transform: transforms.toNumber },
  { from: 'advanced.greyLevel', to: 'Advanced.Grey Level', transform: transforms.toNumber },
  { from: 'advanced.antialiasing', to: 'Advanced.Anti-aliasing', transform: transforms.id },
  { from: 'advanced.antialiasingLevel', to: 'Advanced.Anti-aliasing Level', transform: transforms.antiAliasingLevelUiToBackend },
  { from: ui => !!(ui?.advanced?.antialiasing && ui?.advanced?.imageBlurEnable), to: 'Advanced.Image Blur' },
  { from: 'advanced.imageBlurPixel', to: 'Advanced.Image Blur Pixel', transform: transforms.imageBlurPixelUiToBackend },
  { from: 'advanced.innerCompensate', to: 'Advanced.Inner Compensate', transform: transforms.toNumber },
  { from: 'advanced.outerCompensate', to: 'Advanced.Outer Compensate', transform: transforms.toNumber },
]

// UI whitelist (dot paths) for controlled deep merge
export const uiWhitelist = [
  'schemaVersion',
  'resin.name',
  'machine.name',
  'machine.type',
  'machine.resolution.x',
  'machine.resolution.y',
  'machine.zHeight',
  'machine.mirror',
  'machine.bedSize.x',
  'machine.bedSize.y',
  'machine.margin',

  'print.layerHeight',
  'print.exposure',
  'print.bottom.layers',
  'print.bottom.exposure',
  'print.lightOffDelay',
  'print.transition.count',
  'print.restBeforeLift',
  'print.restAfterLift',

  'motion.bottom.liftHeight',
  'motion.bottom.liftSpeed',
  'motion.bottom.retractSpeed',
  'motion.bottom.retractDistance',
  'motion.bottom.liftSecondDistance',
  'motion.bottom.liftSecondSpeed',
  'motion.bottom.retractSecondSpeed',
  'motion.normal.liftHeight',
  'motion.normal.liftSpeed',
  'motion.normal.retractSpeed',
  'motion.normal.retractDistance',
  'motion.normal.liftSecondDistance',
  'motion.normal.liftSecondSpeed',
  'motion.normal.retractSecondSpeed',

  'gcode.start',
  'gcode.mid',
  'gcode.end',

  'advanced.lightPWM',
  'advanced.bottomLightPWM',
  'advanced.greyLevel',
  'advanced.antialiasing',
  'advanced.antialiasingLevel',
  'advanced.imageBlurEnable',
  'advanced.imageBlurPixel',
  'advanced.innerCompensate',
  'advanced.outerCompensate',
]

// Utilities exported for adapters/merge
export const mappingUtils = { getByPath, setByPath }
