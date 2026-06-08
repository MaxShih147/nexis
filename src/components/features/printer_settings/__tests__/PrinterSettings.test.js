import PrinterSettings from '@/components/features/printer_settings/PrinterSettings.vue'
import i18n from '@/i18n'
import { useParamsStore } from '@/stores/useParamsStore'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    errorKey: vi.fn(),
    successKey: vi.fn(),
    infoKey: vi.fn(),
    warnKey: vi.fn(),
  }),
}))

vi.mock('@/utils/fileUtils', () => ({
  downloadProfileXml: vi.fn(),
}))

vi.mock('@/utils/importProfileBus', () => ({
  requestImportProfile: vi.fn(),
}))

vi.mock('@/params/exportProfileXml', () => ({
  buildProfileExport: vi.fn(),
}))

function makeUi() {
  return {
    schemaVersion: 1,
    machine: {
      name: 'Test Printer',
      type: 'Test',
      resolution: { x: 3840, y: 2160 },
      zHeight: 200,
      mirror: false,
      bedSize: { x: 218, y: 123 },
    },
    print: {
      layerHeight: 0.05,
      exposure: 2.5,
      bottom: {
        layers: 5,
        exposure: 35,
      },
      transition: {
        count: 6,
      },
      lightOffDelay: 0,
      restBeforeLift: 0,
      restAfterLift: 0,
    },
    motion: {
      normal: {
        liftHeight: 6,
        liftSecondDistance: 2,
        retractDistance: 5,
        liftSpeed: 60,
        liftSecondSpeed: 0,
        retractSpeed: 150,
        retractSecondSpeed: 0,
      },
      bottom: {
        liftHeight: 6,
        liftSecondDistance: 0,
        retractDistance: 6,
        liftSpeed: 60,
        liftSecondSpeed: 0,
        retractSpeed: 150,
        retractSecondSpeed: 0,
      },
    },
    advanced: {
      lightPWM: 255,
      bottomLightPWM: 255,
      greyLevel: 0,
      antialiasing: false,
      antialiasingLevel: 4,
      imageBlurPixel: 2,
    },
  }
}

function mountPrinterSettings(uiOverrides = {}) {
  setActivePinia(createPinia())
  const store = useParamsStore()
  store.profile.machineName = 'test-printer'
  store.uiParams = {
    ...makeUi(),
    ...uiOverrides,
    print: {
      ...makeUi().print,
      ...uiOverrides.print,
      bottom: {
        ...makeUi().print.bottom,
        ...uiOverrides.print?.bottom,
      },
    },
    motion: {
      normal: {
        ...makeUi().motion.normal,
        ...uiOverrides.motion?.normal,
      },
      bottom: {
        ...makeUi().motion.bottom,
        ...uiOverrides.motion?.bottom,
      },
    },
    advanced: {
      ...makeUi().advanced,
      ...uiOverrides.advanced,
    },
  }
  store.sourceInfo = {}

  const wrapper = mount(PrinterSettings, {
    global: {
      plugins: [i18n],
      stubs: {
        Button: { template: '<button><slot /></button>' },
        Message: { template: '<div><slot /></div>' },
        SelectButton: { template: '<div />' },
        Select: {
          inheritAttrs: false,
          props: ['modelValue', 'options'],
          template: `
            <select
              :data-testid="$attrs['data-testid']"
              :value="modelValue"
              @change="$emit('update:modelValue', Number($event.target.value))"
            >
              <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          `,
        },
      },
    },
  })

  return { wrapper, store }
}

describe('printerSettings retract distance fields', () => {
  it('renders normal retract first column as editable input (dist1) and second column as derived dist2 text', async () => {
    const { wrapper, store } = mountPrinterSettings()

    const input = wrapper.get('[data-testid="normal-retract-distance-input"]')
    const derived = wrapper.get('[data-testid="normal-retract-distance-derived"]')

    // dist1 (editable) = lift + liftSecond − dist2 = 6 + 2 − 5 = 3
    expect(input.element.value).toBe('3')
    // dist2 (derived, read-only) = retractDistance = 5
    expect(derived.element.tagName).toBe('DIV')
    expect(derived.text()).toBe('5')

    // editing dist1 → dist2 = lift + liftSecond − dist1 = 6 + 2 − 4 = 4, written back to retractDistance
    await input.setValue('4')
    await nextTick()

    expect(store.uiParams.motion.normal.retractDistance).toBe(4)
    expect(wrapper.get('[data-testid="normal-retract-distance-derived"]').text()).toBe('4')
  })

  it('renders bottom retract first column as editable input (dist1) and keeps zero visible there', () => {
    const { wrapper } = mountPrinterSettings()

    const input = wrapper.get('[data-testid="bottom-retract-distance-input"]')
    const derived = wrapper.get('[data-testid="bottom-retract-distance-derived"]')

    // dist1 (editable) = 6 + 0 − 6 = 0
    expect(input.element.value).toBe('0')
    // dist2 (derived, read-only) = retractDistance = 6
    expect(derived.element.tagName).toBe('DIV')
    expect(derived.text()).toBe('6')
  })

  it('flags the editable dist1 input when dist1 is large enough to drive dist2 negative', async () => {
    const { wrapper, store } = mountPrinterSettings()

    const input = wrapper.get('[data-testid="normal-retract-distance-input"]')

    // dist1 = 12 → dist2 = lift + liftSecond − dist1 = 6 + 2 − 12 = −4, written back to retractDistance
    await input.setValue('12')
    await nextTick()

    expect(store.uiParams.motion.normal.retractDistance).toBe(-4)
    // dist2 < 0 is caught by FIELD_DEFS.min = 0, surfacing the error on the dist1 input (red border)
    expect(input.classes()).toContain('!border-red-500')
  })
})

describe('printerSettings image blur fields', () => {
  it('hides blur controls when anti-aliasing is off', () => {
    const { wrapper } = mountPrinterSettings({ advanced: { antialiasing: false } })
    expect(wrapper.find('[data-testid="image-blur-enable"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="image-blur-pixel-input"]').exists()).toBe(false)
  })

  it('shows enable when AA is on but hides pixel until enable is checked', () => {
    const { wrapper } = mountPrinterSettings({
      advanced: { antialiasing: true, imageBlurEnable: false },
    })
    expect(wrapper.find('[data-testid="image-blur-enable"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="image-blur-pixel-input"]').exists()).toBe(false)
  })

  it('renders blur pixel as Select (not number input) when AA and blur enable are on', async () => {
    const { wrapper, store } = mountPrinterSettings({
      advanced: { antialiasing: true, imageBlurEnable: true, imageBlurPixel: 3 },
    })

    const blurSelect = wrapper.find('[data-testid="image-blur-pixel-select"]')
    expect(blurSelect.exists()).toBe(true)
    expect(blurSelect.element.value).toBe('3')

    await blurSelect.setValue('5')
    await nextTick()

    expect(store.uiParams.advanced.imageBlurPixel).toBe(5)
  })

  it('blur pixel Select has exactly options [2,3,4,5,6,7,8]', () => {
    const { wrapper } = mountPrinterSettings({
      advanced: { antialiasing: true, imageBlurEnable: true, imageBlurPixel: 2 },
    })
    const blurSelect = wrapper.find('[data-testid="image-blur-pixel-select"]')
    expect(blurSelect.exists()).toBe(true)
    const optionValues = Array.from(blurSelect.element.options).map(o => Number(o.value))
    expect(optionValues).toEqual([2, 3, 4, 5, 6, 7, 8])
  })
})

describe('printerSettings antialiasing level field', () => {
  it('hides AA level select when anti-aliasing is off', () => {
    const { wrapper } = mountPrinterSettings({ advanced: { antialiasing: false } })
    expect(wrapper.find('[data-testid="antialiasing-level-select"]').exists()).toBe(false)
  })

  it('shows AA level select when anti-aliasing is on', () => {
    const { wrapper } = mountPrinterSettings({ advanced: { antialiasing: true, antialiasingLevel: 4 } })
    expect(wrapper.find('[data-testid="antialiasing-level-select"]').exists()).toBe(true)
  })

  it('renders select and syncs level changes to store', async () => {
    const { wrapper, store } = mountPrinterSettings({ advanced: { antialiasing: true, antialiasingLevel: 4 } })

    const select = wrapper.get('[data-testid="antialiasing-level-select"]')
    expect(select.element.value).toBe('4')

    await select.setValue('8')
    await nextTick()

    expect(store.uiParams.advanced.antialiasingLevel).toBe(8)
  })
})
