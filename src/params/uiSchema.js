// Zod UI schema + UI-centric defaults. AA/blur are profile-agnostic application defaults
// sourced from mappingTables constants; all machines and resins resolve to the same state.
import { z } from 'zod'
import adapters from './adapters.js'
import {
  AA_UI_LEVELS,
  ANTI_ALIASING_ENABLE_DEFAULT,
  ANTI_ALIASING_LEVEL_UI_DEFAULT,
  BLUR_UI_LEVELS,
  BLUR_UI_MAX,
  BLUR_UI_MIN,
  IMAGE_BLUR_ENABLE_DEFAULT,
  IMAGE_BLUR_PIXEL_DEFAULT,
} from './mappingTables.js'

export const FIELD_DEFS = {
  'print.layerHeight': { label: 'domains.legacy.layerHeight', unit: 'mm', min: 0.001, max: 5000 },
  'print.transition.count': { label: 'domains.legacy.transitionLayerCount', min: 1, max: 5000 },
  'print.lightOffDelay': { label: 'domains.legacy.lightOffDelay', unit: 's', min: 0, max: 5000 },
  'print.restBeforeLift': { label: 'domains.legacy.delayBeforeLifting', unit: 's', min: 0, max: 5000 },
  'print.restAfterLift': { label: 'domains.legacy.delayAfterLifting', unit: 's', min: 0, max: 5000 },
  'print.exposure': { label: 'domains.legacy.exposureTime', unit: 's', min: 0.001, max: 5000 },
  'print.bottom.layers': { label: 'domains.legacy.layerCount', min: 1, max: 5000 },
  'print.bottom.exposure': { label: 'domains.legacy.exposureTime', unit: 's', min: 0.001, max: 5000 },
  'motion.normal.liftHeight': { label: 'domains.legacy.liftingDistance', unit: 'mm', min: 0.01, max: 5000 },
  'motion.normal.liftSecondDistance': { label: 'domains.legacy.liftingSecondDistance', min: 0, max: 5000 },
  'motion.normal.retractDistance': { label: 'domains.legacy.retractDistance', unit: 'mm', min: 0, max: 5000 },
  'motion.normal.retractSecondDistance': { label: 'domains.legacy.retractSecondDistance', min: 0, max: 5000 },
  'motion.normal.liftSpeed': { label: 'domains.legacy.liftingSpeed', unit: 'mm/min', min: 0.6, max: 5000 },
  'motion.normal.liftSecondSpeed': { label: 'domains.legacy.liftingSecondSpeed', min: 0, max: 5000 },
  'motion.normal.retractSpeed': { label: 'domains.legacy.retractSpeed', unit: 'mm/min', min: 0.6, max: 5000 },
  'motion.normal.retractSecondSpeed': { label: 'domains.legacy.retractSecondSpeed', min: 0, max: 5000 },
  'motion.bottom.liftHeight': { label: 'domains.legacy.liftingDistance', unit: 'mm', min: 0.01, max: 5000 },
  'motion.bottom.liftSecondDistance': { label: 'domains.legacy.liftingSecondDistance', min: 0, max: 5000 },
  'motion.bottom.retractDistance': { label: 'domains.legacy.retractDistance', unit: 'mm', min: 0, max: 5000 },
  'motion.bottom.retractSecondDistance': { label: 'domains.legacy.retractSecondDistance', min: 0, max: 5000 },
  'motion.bottom.liftSpeed': { label: 'domains.legacy.liftingSpeed', unit: 'mm/min', min: 0.6, max: 5000 },
  'motion.bottom.liftSecondSpeed': { label: 'domains.legacy.liftingSecondSpeed', min: 0, max: 5000 },
  'motion.bottom.retractSpeed': { label: 'domains.legacy.retractSpeed', unit: 'mm/min', min: 0.6, max: 5000 },
  'motion.bottom.retractSecondSpeed': { label: 'domains.legacy.retractSecondSpeed', min: 0, max: 5000 },
  'advanced.lightPWM': { label: 'domains.legacy.lightPwm', min: 0, max: 255 },
  'advanced.bottomLightPWM': { label: 'domains.legacy.bottomLightPwm', min: 0, max: 255 },
  'advanced.greyLevel': { label: 'domains.legacy.greyLevel', min: 0, max: 8 },
  'advanced.antialiasing': { label: 'domains.legacy.antiAliasing', default: ANTI_ALIASING_ENABLE_DEFAULT },
  'advanced.antialiasingLevel': { label: 'domains.legacy.antiAliasingLevel', min: 2, max: 8, values: AA_UI_LEVELS, default: ANTI_ALIASING_LEVEL_UI_DEFAULT },
  'advanced.imageBlurEnable': { label: 'domains.legacy.imageBlurEnable', default: IMAGE_BLUR_ENABLE_DEFAULT },
  'advanced.imageBlurPixel': { label: 'domains.legacy.imageBlurPixel', min: BLUR_UI_MIN, max: BLUR_UI_MAX, default: IMAGE_BLUR_PIXEL_DEFAULT, values: BLUR_UI_LEVELS },
}

export function fieldLabel(path, t) {
  const def = FIELD_DEFS[path]
  if (!def)
    return ''
  const label = t ? t(def.label) : def.label
  return def.unit ? `${label} (${def.unit})` : label
}

function numField(key, { int = false, optional = false } = {}) {
  const { min, max } = FIELD_DEFS[key]
  const msg = `Value must be between ${min} and ${max}.`
  let s = z.number().min(min, msg).max(max, msg)
  if (int)
    s = s.int()
  if (optional)
    s = s.optional()
  return s
}

// Retract Distance UI has two columns:
//   欄1 (editable)            = liftHeight + liftSecondDistance − retractDistance
//   欄2 (derived, read-only)  = retractDistance
// `derived` below equals 欄1 (the editable column); `retract` equals 欄2.
// Validation rules:
//   - Each column individually MAY be 0
//   - Neither column may be negative (欄1 < 0 → fail; 欄2 < 0 caught by FIELD_DEFS.min = 0)
//   - The sum 欄1 + 欄2 SHALL NOT be 0 (i.e., the two columns cannot both be 0 simultaneously)
const RETRACT_DISTANCE_FIELDS = [
  {
    path: ['motion', 'normal', 'retractDistance'],
    liftPath: ['motion', 'normal', 'liftHeight'],
    liftSecondPath: ['motion', 'normal', 'liftSecondDistance'],
    retractPath: ['motion', 'normal', 'retractDistance'],
  },
  {
    path: ['motion', 'bottom', 'retractDistance'],
    liftPath: ['motion', 'bottom', 'liftHeight'],
    liftSecondPath: ['motion', 'bottom', 'liftSecondDistance'],
    retractPath: ['motion', 'bottom', 'retractDistance'],
  },
]

export const RETRACT_DERIVED_NEGATIVE_KEY = 'validation.range.retractDerivedNegative'
export const RETRACT_BOTH_ZERO_KEY = 'validation.range.retractBothZero'
export const AA_LEVEL_KEY = 'validation.antialiasingLevel.mustBe248'

function getNestedNumber(data, path, fallback = 0) {
  let cur = data
  for (const part of path)
    cur = cur?.[part]
  const value = Number(cur)
  return Number.isFinite(value) ? value : fallback
}

function validateRetractDistance(data, ctx, config) {
  const lift = getNestedNumber(data, config.liftPath)
  const liftSecond = getNestedNumber(data, config.liftSecondPath)
  const retract = getNestedNumber(data, config.retractPath)
  const derived = lift + liftSecond - retract

  if (derived < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: config.path,
      message: RETRACT_DERIVED_NEGATIVE_KEY,
    })
    return
  }
  if (derived === 0 && retract === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: config.path,
      message: RETRACT_BOTH_ZERO_KEY,
    })
  }
}

// Unified UI schema (seconds, mm/min for speeds)
const baseUiSchema = z.object({
  schemaVersion: z.literal(1),
  resin: z.object({ name: z.string() }).partial().optional(),
  machine: z.object({
    name: z.string().min(1, 'Machine name required'),
    type: z.string().optional(),
    resolution: z.object({
      x: z.number().nonnegative('Image width must be >= 0'),
      y: z.number().nonnegative('Image height must be >= 0'),
    }),
    zHeight: z.number().positive('Z height must be > 0'),
    mirror: z.boolean().optional(),
    bedSize: z.object({ x: z.number().nonnegative(), y: z.number().nonnegative() }).optional(),
    margin: z.number().nonnegative().optional(),
  }),
  print: z.object({
    layerHeight: numField('print.layerHeight'), // mm
    exposure: numField('print.exposure'), // s
    bottom: z.object({
      layers: numField('print.bottom.layers', { int: true }),
      exposure: numField('print.bottom.exposure'),
    }),
    lightOffDelay: numField('print.lightOffDelay', { optional: true }),
    transition: z.object({
      count: numField('print.transition.count', { int: true }),
    }).optional(),
    restBeforeLift: numField('print.restBeforeLift', { optional: true }),
    restAfterLift: numField('print.restAfterLift', { optional: true }),
  }),
  motion: z.object({
    bottom: z.object({
      liftHeight: numField('motion.bottom.liftHeight'), // mm
      liftSpeed: numField('motion.bottom.liftSpeed'), // mm/min
      retractSpeed: numField('motion.bottom.retractSpeed'), // mm/min
      retractDistance: numField('motion.bottom.retractDistance', { optional: true }),
      liftSecondDistance: numField('motion.bottom.liftSecondDistance', { optional: true }),
      liftSecondSpeed: numField('motion.bottom.liftSecondSpeed', { optional: true }),
      retractSecondDistance: numField('motion.bottom.retractSecondDistance', { optional: true }),
      retractSecondSpeed: numField('motion.bottom.retractSecondSpeed', { optional: true }),
    }),
    normal: z.object({
      liftHeight: numField('motion.normal.liftHeight'), // mm
      liftSpeed: numField('motion.normal.liftSpeed'), // mm/min
      retractSpeed: numField('motion.normal.retractSpeed'), // mm/min
      retractDistance: numField('motion.normal.retractDistance', { optional: true }),
      liftSecondDistance: numField('motion.normal.liftSecondDistance', { optional: true }),
      liftSecondSpeed: numField('motion.normal.liftSecondSpeed', { optional: true }),
      retractSecondDistance: numField('motion.normal.retractSecondDistance', { optional: true }),
      retractSecondSpeed: numField('motion.normal.retractSecondSpeed', { optional: true }),
    }),
  }),
  gcode: z.object({ start: z.string(), mid: z.string(), end: z.string() }).partial().optional(),
  advanced: z.object({
    lightPWM: numField('advanced.lightPWM', { optional: true }),
    bottomLightPWM: numField('advanced.bottomLightPWM', { optional: true }),
    greyLevel: numField('advanced.greyLevel', { int: true, optional: true }),
    antialiasing: z.boolean().optional(),
    antialiasingLevel: z.number().int().refine(
      v => AA_UI_LEVELS.includes(v),
      { message: AA_LEVEL_KEY },
    ).optional(),
    imageBlurEnable: z.boolean().optional(),
    imageBlurPixel: numField('advanced.imageBlurPixel', { int: true, optional: true }),
    innerCompensate: z.number().optional(),
    outerCompensate: z.number().optional(),
  }).optional(),
})

export const uiSchema = baseUiSchema.superRefine((data, ctx) => {
  for (const config of RETRACT_DISTANCE_FIELDS)
    validateRetractDistance(data, ctx, config)
})

export const uiDefaults = adapters.seededUiDefaults // values-only seed mapped to UI keys

export const validateUi = ui => uiSchema.safeParse(ui)

export function getUiFieldError(ui, path, t) {
  const result = validateUi(ui)
  if (result.success)
    return ''
  const targetPath = path.split('.')
  const issue = result.error.issues.find(({ path: issuePath }) => (
    issuePath.length === targetPath.length
    && issuePath.every((part, index) => part === targetPath[index])
  ))
  if (!issue)
    return ''
  if (t) {
    const def = FIELD_DEFS[path]
    if (def && (issue.code === 'too_small' || issue.code === 'too_big'))
      return t('validation.range.between', { min: def.min, max: def.max })
    if (issue.code === 'custom' && (issue.message === RETRACT_DERIVED_NEGATIVE_KEY || issue.message === RETRACT_BOTH_ZERO_KEY))
      return t(issue.message)
  }
  return issue.message
}

export function formatUiIssue(issue, t) {
  const path = Array.isArray(issue?.path) ? issue.path.join('.') : ''
  const def = FIELD_DEFS[path]

  if (t) {
    if (def && (issue.code === 'too_small' || issue.code === 'too_big'))
      return `${fieldLabel(path, t)} ${t('validation.range.between', { min: def.min, max: def.max })}`
    if (issue.code === 'custom' && (issue.message === RETRACT_DERIVED_NEGATIVE_KEY || issue.message === RETRACT_BOTH_ZERO_KEY))
      return `${fieldLabel(path, t)} ${t(issue.message)}`
    return issue?.message ?? t('common.messages.reviewParams')
  }

  return issue?.message ?? 'Please review your parameters.'
}
