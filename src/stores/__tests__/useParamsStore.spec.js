import seedDefault from '@/data/default_profiles/sonic_ls_plus.json'
import { AA_UI_LEVELS, BLUR_UI_MAX, BLUR_UI_MIN } from '@/params/mappingTables'
import { useParamsStore } from '@/stores/useParamsStore'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

describe('useParamsStore advanced overrides', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('restores imported AA/blur values after resin selection resets params', () => {
    const store = useParamsStore()
    store.loadCustomMachine({
      machineName: 'test-printer',
      machineLabel: 'Test Printer',
      defaultJson: seedDefault,
      resinJson: null,
    })

    store.applyResin(null, { preserveUserEdits: false, markDirty: false })
    store.applyAdvancedOverrides({
      antialiasing: true,
      antialiasingLevel: 8,
      imageBlurEnable: true,
      imageBlurPixel: 5,
    })

    expect(store.uiParams.advanced).toMatchObject({
      antialiasing: true,
      antialiasingLevel: 8,
      imageBlurEnable: true,
      imageBlurPixel: 5,
    })
    expect(store.sourceInfo.advanced).toMatchObject({
      antialiasing: 'user',
      antialiasingLevel: 'user',
      imageBlurEnable: 'user',
      imageBlurPixel: 'user',
    })
  })

  it('ignores antialiasingLevel values not in AA_UI_LEVELS', () => {
    const store = useParamsStore()
    store.loadCustomMachine({ machineName: 'x', machineLabel: 'X', defaultJson: seedDefault, resinJson: null })
    const before = store.uiParams.advanced.antialiasingLevel
    store.applyAdvancedOverrides({ antialiasingLevel: 99 })
    expect(store.uiParams.advanced.antialiasingLevel).toBe(before)
    store.applyAdvancedOverrides({ antialiasingLevel: 3 })
    expect(store.uiParams.advanced.antialiasingLevel).toBe(before)
  })

  it('accepts all valid AA_UI_LEVELS values for antialiasingLevel', () => {
    const store = useParamsStore()
    store.loadCustomMachine({ machineName: 'x', machineLabel: 'X', defaultJson: seedDefault, resinJson: null })
    for (const level of AA_UI_LEVELS) {
      store.applyAdvancedOverrides({ antialiasingLevel: level })
      expect(store.uiParams.advanced.antialiasingLevel).toBe(level)
    }
  })

  it('ignores imageBlurPixel values outside BLUR_UI_MIN–BLUR_UI_MAX', () => {
    const store = useParamsStore()
    store.loadCustomMachine({ machineName: 'x', machineLabel: 'X', defaultJson: seedDefault, resinJson: null })
    const before = store.uiParams.advanced.imageBlurPixel
    store.applyAdvancedOverrides({ imageBlurPixel: BLUR_UI_MIN - 1 })
    expect(store.uiParams.advanced.imageBlurPixel).toBe(before)
    store.applyAdvancedOverrides({ imageBlurPixel: BLUR_UI_MAX + 1 })
    expect(store.uiParams.advanced.imageBlurPixel).toBe(before)
  })

  it('ignores non-integer imageBlurPixel values', () => {
    const store = useParamsStore()
    store.loadCustomMachine({ machineName: 'x', machineLabel: 'X', defaultJson: seedDefault, resinJson: null })
    const before = store.uiParams.advanced.imageBlurPixel
    store.applyAdvancedOverrides({ imageBlurPixel: 2.5 })
    expect(store.uiParams.advanced.imageBlurPixel).toBe(before)
  })

  it('accepts all valid BLUR_UI_MIN–BLUR_UI_MAX integers for imageBlurPixel', () => {
    const store = useParamsStore()
    store.loadCustomMachine({ machineName: 'x', machineLabel: 'X', defaultJson: seedDefault, resinJson: null })
    for (let v = BLUR_UI_MIN; v <= BLUR_UI_MAX; v++) {
      store.applyAdvancedOverrides({ imageBlurPixel: v })
      expect(store.uiParams.advanced.imageBlurPixel).toBe(v)
    }
  })
})
