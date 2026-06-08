import { describe, expect, it } from 'vitest'
import { seededUiDefaults } from '../adapters'
import { BLUR_UI_LEVELS } from '../mappingTables'
import { FIELD_DEFS, formatUiIssue, validateUi } from '../uiSchema'

describe('formatUiIssue without t', () => {
  it('returns raw Zod message without i18n key path prefix', () => {
    const issue = { path: ['motion', 'normal', 'liftSpeed'], code: 'too_small' }
    issue.message = 'Value must be between 0.01 and 5000.'

    const result = formatUiIssue(issue)

    expect(result).not.toMatch(/domains\.legacy\./i)
    expect(result).not.toMatch(/domains\./i)
  })

  it('returns raw Zod message for unknown path without t', () => {
    const issue = { path: ['print', 'layerHeight'], code: 'too_big' }
    issue.message = 'Value must be between 0.001 and 5000.'

    const result = formatUiIssue(issue)

    expect(result).not.toMatch(/domains\.legacy\./i)
  })
})

describe('fIELD_DEFS — removed bottom delay keys', () => {
  it('does not expose a dedicated bottom before-lift delay field', () => {
    const key = ['print', 'bottom', 'restBefore', 'Lift'].join('.')
    expect(FIELD_DEFS[key]).toBeUndefined()
  })

  it('does not expose a dedicated bottom after-lift delay field', () => {
    const key = ['print', 'bottom', 'restAfter', 'Lift'].join('.')
    expect(FIELD_DEFS[key]).toBeUndefined()
  })

  it('no longer exposes print.bottom.lightOffDelay', () => {
    expect(FIELD_DEFS['print.bottom.lightOffDelay']).toBeUndefined()
  })
})

describe('uiSchema validation — bottom delay keys', () => {
  function makeUi(bottomOverrides) {
    return {
      ...seededUiDefaults,
      print: {
        ...seededUiDefaults.print,
        bottom: { ...seededUiDefaults.print.bottom, ...bottomOverrides },
      },
    }
  }

  it('accepts omitted bottom-only delay fields', () => {
    const ui = makeUi({})
    const result = validateUi(ui)
    expect(result.success).toBe(true)
  })
})

describe('uiSchema validation — Retract Distance two-column rules', () => {
  function makeUi(motionOverrides = {}) {
    return {
      ...seededUiDefaults,
      motion: {
        bottom: { ...seededUiDefaults.motion.bottom, ...motionOverrides.bottom },
        normal: { ...seededUiDefaults.motion.normal, ...motionOverrides.normal },
      },
    }
  }

  it('accepts normal retractDistance = 0 when first column (dist1) is non-zero', () => {
    const result = validateUi(makeUi({
      normal: { liftHeight: 6, liftSecondDistance: 2, retractDistance: 0 },
    }))
    expect(result.success).toBe(true)
  })

  it('accepts normal first column (dist1) = 0 when retractDistance (col 2) is non-zero', () => {
    const result = validateUi(makeUi({
      normal: { liftHeight: 6, liftSecondDistance: 2, retractDistance: 8 },
    }))
    expect(result.success).toBe(true)
  })

  it('accepts bottom retractDistance = 0 when first column (dist1) is non-zero', () => {
    const result = validateUi(makeUi({
      bottom: { liftHeight: 6, liftSecondDistance: 0, retractDistance: 0 },
    }))
    expect(result.success).toBe(true)
  })

  it('flags normal Retract Distance when both columns are 0 (sum = 0)', () => {
    const result = validateUi(makeUi({
      normal: { liftHeight: 0, liftSecondDistance: 0, retractDistance: 0 },
    }))
    expect(result.success).toBe(false)
    const issue = result.error.issues.find(i => i.path.join('.') === 'motion.normal.retractDistance')
    expect(issue?.message).toBe('validation.range.retractBothZero')
  })

  it('flags bottom Retract Distance when both columns are 0 (sum = 0)', () => {
    const result = validateUi(makeUi({
      bottom: { liftHeight: 0, liftSecondDistance: 0, retractDistance: 0 },
    }))
    expect(result.success).toBe(false)
    const issue = result.error.issues.find(i => i.path.join('.') === 'motion.bottom.retractDistance')
    expect(issue?.message).toBe('validation.range.retractBothZero')
  })

  it('flags normal Retract Distance when first column (dist1) is negative', () => {
    const result = validateUi(makeUi({
      normal: { liftHeight: 6, liftSecondDistance: 1, retractDistance: 10 },
    }))
    expect(result.success).toBe(false)
    const issue = result.error.issues.find(i => i.path.join('.') === 'motion.normal.retractDistance')
    expect(issue?.message).toBe('validation.range.retractDerivedNegative')
  })

  it('flags bottom Retract Distance when first column (dist1) is negative', () => {
    const result = validateUi(makeUi({
      bottom: { liftHeight: 6, liftSecondDistance: 0, retractDistance: 10 },
    }))
    expect(result.success).toBe(false)
    const issue = result.error.issues.find(i => i.path.join('.') === 'motion.bottom.retractDistance')
    expect(issue?.message).toBe('validation.range.retractDerivedNegative')
  })

  it('rejects negative retractDistance (col 2) via FIELD_DEFS min = 0', () => {
    const result = validateUi(makeUi({
      bottom: { retractDistance: -999 },
    }))
    expect(result.success).toBe(false)
    expect(result.error.issues.some(i => i.path.join('.') === 'motion.bottom.retractDistance' && i.code === 'too_small')).toBe(true)
  })

  it('rejects retractDistance above FIELD_DEFS max', () => {
    const result = validateUi(makeUi({
      normal: { retractDistance: 99999 },
    }))
    expect(result.success).toBe(false)
    expect(result.error.issues.some(i => i.path.join('.') === 'motion.normal.retractDistance' && i.code === 'too_big')).toBe(true)
  })
})

describe('uiSchema validation — schemaVersion', () => {
  it('accepts schemaVersion 1', () => {
    expect(validateUi({ ...seededUiDefaults, schemaVersion: 1 }).success).toBe(true)
  })

  it('rejects schemaVersion 2 (migration path removed; all params resolve to version 1)', () => {
    const result = validateUi({ ...seededUiDefaults, schemaVersion: 2 })
    expect(result.success).toBe(false)
  })
})

describe('uiSchema validation — imageBlurPixel', () => {
  function makeUi(advancedOverrides = {}) {
    return {
      ...seededUiDefaults,
      schemaVersion: 1,
      advanced: { ...seededUiDefaults.advanced, ...advancedOverrides },
    }
  }

  it('FIELD_DEFS exposes BLUR_UI_LEVELS as values for imageBlurPixel', () => {
    expect(FIELD_DEFS['advanced.imageBlurPixel'].values).toEqual(BLUR_UI_LEVELS)
  })

  it('accepts all BLUR_UI_LEVELS values', () => {
    for (const v of BLUR_UI_LEVELS) {
      expect(validateUi(makeUi({ imageBlurPixel: v })).success).toBe(true)
    }
  })

  it('rejects imageBlurPixel above 8', () => {
    const result = validateUi(makeUi({ imageBlurPixel: 9 }))
    expect(result.success).toBe(false)
    expect(result.error.issues.some(i => i.path.join('.') === 'advanced.imageBlurPixel' && i.code === 'too_big')).toBe(true)
  })

  it('rejects imageBlurPixel below 2', () => {
    const result = validateUi(makeUi({ imageBlurPixel: 1 }))
    expect(result.success).toBe(false)
    expect(result.error.issues.some(i => i.path.join('.') === 'advanced.imageBlurPixel' && i.code === 'too_small')).toBe(true)
  })
})

describe('uiSchema validation — antialiasingLevel display', () => {
  function makeUi(advancedOverrides = {}) {
    return {
      ...seededUiDefaults,
      schemaVersion: 1,
      advanced: { ...seededUiDefaults.advanced, ...advancedOverrides },
    }
  }

  it('accepts only 2, 4, or 8', () => {
    expect(validateUi(makeUi({ antialiasingLevel: 4 })).success).toBe(true)
  })

  it('rejects legacy backend index 1', () => {
    const result = validateUi(makeUi({ antialiasingLevel: 1 }))
    expect(result.success).toBe(false)
  })
})
