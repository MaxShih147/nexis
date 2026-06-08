import { describe, expect, it } from 'vitest'
import {
  ANTI_ALIASING_ENABLE_DEFAULT,
  ANTI_ALIASING_LEVEL_UI_DEFAULT,
  IMAGE_BLUR_ENABLE_DEFAULT,
  IMAGE_BLUR_PIXEL_DEFAULT,
  transforms,
} from '../mappingTables.js'

describe('antiAliasingLevelBackendToUi / antiAliasingLevelUiToBackend', () => {
  it('maps backend 0/1/2 to UI 2/4/8', () => {
    expect(transforms.antiAliasingLevelBackendToUi(0)).toBe(2)
    expect(transforms.antiAliasingLevelBackendToUi(1)).toBe(4)
    expect(transforms.antiAliasingLevelBackendToUi(2)).toBe(8)
  })

  it('maps UI 2/4/8 to backend 0/1/2', () => {
    expect(transforms.antiAliasingLevelUiToBackend(2)).toBe(0)
    expect(transforms.antiAliasingLevelUiToBackend(4)).toBe(1)
    expect(transforms.antiAliasingLevelUiToBackend(8)).toBe(2)
  })
})

describe('imageBlurPixelBackendToUi / imageBlurPixelUiToBackend', () => {
  it('maps UI 2–8 to backend 1–7', () => {
    expect(transforms.imageBlurPixelUiToBackend(2)).toBe(1)
    expect(transforms.imageBlurPixelUiToBackend(8)).toBe(7)
    expect(transforms.imageBlurPixelBackendToUi(7)).toBe(8)
  })

  it('maps backend 1 to UI 2', () => {
    expect(transforms.imageBlurPixelBackendToUi(1)).toBe(2)
  })
})

describe('application-level AA/blur defaults', () => {
  it('uses false for ANTI_ALIASING_ENABLE_DEFAULT', () => {
    expect(ANTI_ALIASING_ENABLE_DEFAULT).toBe(false)
  })

  it('uses 4 (4x) for ANTI_ALIASING_LEVEL_UI_DEFAULT', () => {
    expect(ANTI_ALIASING_LEVEL_UI_DEFAULT).toBe(4)
  })

  it('uses false for IMAGE_BLUR_ENABLE_DEFAULT', () => {
    expect(IMAGE_BLUR_ENABLE_DEFAULT).toBe(false)
  })

  it('uses 2 (UI 2 → backend 1) for IMAGE_BLUR_PIXEL_DEFAULT', () => {
    expect(IMAGE_BLUR_PIXEL_DEFAULT).toBe(2)
  })
})
