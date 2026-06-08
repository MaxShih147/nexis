import { describe, expect, it } from 'vitest'
import aaOnProfile from '../../data/default_profiles/sonic_4k_2022.json'
import seedDefault from '../../data/default_profiles/sonic_ls_plus.json'
import { fromDefault, seededUiDefaults, toEngineDefault } from '../adapters.js'
import {
  ANTI_ALIASING_ENABLE_DEFAULT,
  ANTI_ALIASING_LEVEL_UI_DEFAULT,
  IMAGE_BLUR_ENABLE_DEFAULT,
  IMAGE_BLUR_PIXEL_DEFAULT,
} from '../mappingTables.js'
import { resolveParams } from '../resolveParams.js'

function minimalUi(overrides = {}) {
  const { advanced: advancedOverrides, ...rest } = overrides
  return {
    schemaVersion: 1,
    print: { layerHeight: 0.05 },
    machine: {
      resolution: { x: 2560, y: 1440 },
      bedSize: { x: 120, y: 68 },
    },
    advanced: {
      antialiasing: true,
      antialiasingLevel: ANTI_ALIASING_LEVEL_UI_DEFAULT,
      greyLevel: 0,
      imageBlurEnable: true,
      imageBlurPixel: IMAGE_BLUR_PIXEL_DEFAULT,
      ...advancedOverrides,
    },
    ...rest,
  }
}

describe('fromDefault — AA/blur not read from profile', () => {
  it('does not include AA/blur fields from any profile (profile values are ignored)', () => {
    const ui = fromDefault(seedDefault)
    expect(ui.advanced?.antialiasing).toBeUndefined()
    expect(ui.advanced?.antialiasingLevel).toBeUndefined()
    expect(ui.advanced?.imageBlurEnable).toBeUndefined()
    expect(ui.advanced?.imageBlurPixel).toBeUndefined()
  })

  it('does not include AA/blur fields even when profile has AA=true', () => {
    const ui = fromDefault(aaOnProfile)
    expect(ui.advanced?.antialiasing).toBeUndefined()
    expect(ui.advanced?.antialiasingLevel).toBeUndefined()
    expect(ui.advanced?.imageBlurEnable).toBeUndefined()
    expect(ui.advanced?.imageBlurPixel).toBeUndefined()
  })
})

describe('seededUiDefaults — profile-agnostic AA/blur defaults', () => {
  it('has fixed AA/blur defaults matching the application-level constants', () => {
    const adv = seededUiDefaults.advanced
    expect(adv.antialiasing).toBe(ANTI_ALIASING_ENABLE_DEFAULT)
    expect(adv.antialiasingLevel).toBe(ANTI_ALIASING_LEVEL_UI_DEFAULT)
    expect(adv.imageBlurEnable).toBe(IMAGE_BLUR_ENABLE_DEFAULT)
    expect(adv.imageBlurPixel).toBe(IMAGE_BLUR_PIXEL_DEFAULT)
  })

  it('has AA/blur defaults of false/4/false/2 regardless of seed profile', () => {
    expect(seededUiDefaults.advanced.antialiasing).toBe(false)
    expect(seededUiDefaults.advanced.antialiasingLevel).toBe(4)
    expect(seededUiDefaults.advanced.imageBlurEnable).toBe(false)
    expect(seededUiDefaults.advanced.imageBlurPixel).toBe(2)
  })
})

describe('resolveParams — AA/blur uniform across all machines', () => {
  it('resolves AA/blur to false/4/false/2 for a machine with AA=true in its profile (sonic_4k_2022)', () => {
    const { ui } = resolveParams(aaOnProfile)
    expect(ui.advanced.antialiasing).toBe(false)
    expect(ui.advanced.antialiasingLevel).toBe(4)
    expect(ui.advanced.imageBlurEnable).toBe(false)
    expect(ui.advanced.imageBlurPixel).toBe(2)
  })

  it('resolves AA/blur to false/4/false/2 for seed profile machine as well', () => {
    const { ui } = resolveParams(seedDefault)
    expect(ui.advanced.antialiasing).toBe(false)
    expect(ui.advanced.antialiasingLevel).toBe(4)
    expect(ui.advanced.imageBlurEnable).toBe(false)
    expect(ui.advanced.imageBlurPixel).toBe(2)
  })
})

describe('toEngineDefault — UI to profile/Mechado format', () => {
  it('outputs Image Blur and Image Blur Pixel as separate fields', () => {
    const ui = minimalUi({ advanced: { antialiasing: true, imageBlurEnable: true, imageBlurPixel: 4 } })
    const out = toEngineDefault(ui)
    expect(out.Advanced['Image Blur']).toBe(true)
    expect(out.Advanced['Image Blur Pixel']).toBe(3) // 4-1
  })

  it('outputs Image Blur=false when AA is off regardless of imageBlurEnable', () => {
    const ui = minimalUi({ advanced: { antialiasing: false, imageBlurEnable: true, imageBlurPixel: 4 } })
    const out = toEngineDefault(ui)
    expect(out.Advanced['Image Blur']).toBe(false)
  })

  it('converts AA level 8 → backend 2 and pixel 8 → backend 7', () => {
    const ui = minimalUi({ advanced: { antialiasing: true, antialiasingLevel: 8, imageBlurEnable: true, imageBlurPixel: 8 } })
    const out = toEngineDefault(ui)
    expect(out.Advanced['Anti-aliasing Level']).toBe(2)
    expect(out.Advanced['Image Blur Pixel']).toBe(7)
  })

  it('converts AA level 2 → backend 0', () => {
    const ui = minimalUi({ advanced: { antialiasingLevel: 2 } })
    const out = toEngineDefault(ui)
    expect(out.Advanced['Anti-aliasing Level']).toBe(0)
  })
})

describe('resolveParams — schemaVersion', () => {
  it('always outputs schemaVersion 1 regardless of what profile contains', () => {
    const { ui } = resolveParams(aaOnProfile)
    expect(ui.schemaVersion).toBe(1)
  })

  it('outputs schemaVersion 1 for seed profile as well', () => {
    const { ui } = resolveParams(seedDefault)
    expect(ui.schemaVersion).toBe(1)
  })
})
