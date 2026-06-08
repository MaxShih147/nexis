import enMessages from '@/i18n/locales/en.json'
import { useModelStore } from '@/stores/model'
import { useBackendStore } from '@/stores/useBackendStore'
import { useParamsStore } from '@/stores/useParamsStore'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import TextEmbossEditor from '../TextEmbossEditor.vue'

const mountedWrappers = []

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

const SteppedInputStub = defineComponent({
  name: 'SteppedInput',
  props: { modelValue: [String, Number], min: Number, max: Number, step: Number, type: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        'data-testid': 'stepped-input',
        'value': props.modelValue,
        'onInput': e => emit('update:modelValue', Number(e.target.value)),
      })
  },
})

const ButtonStub = defineComponent({
  name: 'Button',
  props: { label: String, loading: Boolean, disabled: Boolean, severity: String },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () =>
      h(
        'button',
        {
          'data-label': props.label,
          'disabled': props.disabled,
          'data-loading': props.loading,
          'onClick': () => !props.disabled && emit('click'),
        },
        slots.default ? slots.default() : props.label,
      )
  },
})

// ---------------------------------------------------------------------------
// Toast mock
// ---------------------------------------------------------------------------
const toastSuccessSpy = vi.fn()
const toastErrorSpy = vi.fn()
const toastWarnSpy = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: toastSuccessSpy,
    error: toastErrorSpy,
    warn: toastWarnSpy,
    errorKey: vi.fn(),
    successKey: vi.fn(),
    info: vi.fn(),
  }),
}))

// ---------------------------------------------------------------------------
// textEmbossService mock
// ---------------------------------------------------------------------------
const embossTextSpy = vi.fn().mockResolvedValue(new Blob(['stl'], { type: 'application/octet-stream' }))

vi.mock('@/services/textEmbossService', () => ({
  embossText: (...args) => embossTextSpy(...args),
}))

// ---------------------------------------------------------------------------
// three mock helpers
// ---------------------------------------------------------------------------
function makeThree(overrides = {}) {
  return {
    generateTextPreview: vi.fn().mockResolvedValue(undefined),
    updateTextPreviewParams: vi.fn(),
    clearTextPreview: vi.fn(),
    isTextPreviewActive: vi.fn().mockReturnValue(false),
    isTextPositionConfirmed: vi.fn().mockReturnValue(false),
    exportModelAsStl: vi.fn().mockResolvedValue(new Blob()),
    exportTextMeshAsStl: vi.fn().mockResolvedValue(new Blob()),
    setTextPositionConfirmedCallback: vi.fn(),
    replaceModelGeometry: vi.fn().mockResolvedValue(undefined),
    getSelectedObject: vi.fn().mockReturnValue({}),
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
    clearTextPreviewWithUndo: vi.fn(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
function createWrapper(three, pinia) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })

  const wrapper = mount(TextEmbossEditor, {
    global: {
      plugins: [i18n, pinia],
      provide: { three },
      stubs: {
        SteppedInput: SteppedInputStub,
        Button: ButtonStub,
        ToothLoadingDialog: { template: '<div />' },
      },
    },
  })
  mountedWrappers.push(wrapper)

  return {
    wrapper,
    backendStore: useBackendStore(),
    modelStore: useModelStore(),
    paramsStore: useParamsStore(),
    t: i18n.global.t,
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let pinia

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  toastSuccessSpy.mockClear()
  toastErrorSpy.mockClear()
  toastWarnSpy.mockClear()
  embossTextSpy.mockClear()
  embossTextSpy.mockResolvedValue(new Blob(['stl'], { type: 'application/octet-stream' }))
})

afterEach(async () => {
  while (mountedWrappers.length) {
    const wrapper = mountedWrappers.pop()
    await wrapper.unmount()
  }
})

// ---------------------------------------------------------------------------
// Task 1.1 – Panel entry availability based on current mode
// ---------------------------------------------------------------------------
describe('1.1 – Panel entry availability by mode', () => {
  it('hides / disables the panel when mode is Splint', async () => {
    const three = makeThree()
    const { wrapper, paramsStore } = createWrapper(three, pinia)

    paramsStore._rawResinJson = { __dental_mode: 'Splint' }
    await nextTick()

    const modeNotice = wrapper.find('[data-testid="mode-disabled-notice"]')
    expect(modeNotice.exists()).toBe(true)
  })

  it('hides / disables the panel when mode is C&B', async () => {
    const three = makeThree()
    const { wrapper, paramsStore } = createWrapper(three, pinia)

    paramsStore._rawResinJson = { __dental_mode: 'C&B' }
    await nextTick()

    const modeNotice = wrapper.find('[data-testid="mode-disabled-notice"]')
    expect(modeNotice.exists()).toBe(true)
  })

  it('shows the panel normally in Dental Model mode', async () => {
    const three = makeThree()
    const { wrapper, paramsStore } = createWrapper(three, pinia)

    paramsStore._rawResinJson = { __dental_mode: 'Dental Model' }
    await nextTick()

    expect(wrapper.find('[data-testid="mode-disabled-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="text-emboss-panel"]').exists()).toBe(true)
  })

  it('shows the panel when no dental mode is set (null)', async () => {
    const three = makeThree()
    const { wrapper, paramsStore } = createWrapper(three, pinia)

    paramsStore._rawResinJson = null
    await nextTick()

    expect(wrapper.find('[data-testid="mode-disabled-notice"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="text-emboss-panel"]').exists()).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Task 1.3 – No-model scenario
// ---------------------------------------------------------------------------
describe('1.3 – No-model scenario', () => {
  it('disables controls and shows hint when no model is in the scene', async () => {
    const three = makeThree()
    const { wrapper } = createWrapper(three, pinia)
    // modelStore.models is empty by default

    await nextTick()

    const noModelNotice = wrapper.find('[data-testid="no-model-notice"]')
    expect(noModelNotice.exists()).toBe(true)

    const textInput = wrapper.find('[data-testid="text-input"]')
    expect(textInput.attributes('disabled')).toBeDefined()
  })

  it('re-enables controls after a model is loaded', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)

    // Simulate loading a model
    modelStore.models.push({ uuid: 'test-uuid', name: 'Test Model' })
    await nextTick()

    expect(wrapper.find('[data-testid="no-model-notice"]').exists()).toBe(false)

    const textInput = wrapper.find('[data-testid="text-input"]')
    expect(textInput.attributes('disabled')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Task 2.1 – Text input: char weight calculation, limit, blank guard
// ---------------------------------------------------------------------------
describe('2.1 – Text input validation and char weight', () => {
  describe('calcCharWeight (via component)', () => {
    it('accepts only the requested language, number, space, and symbol set for preview generation', async () => {
      const three = makeThree()
      const { wrapper, modelStore } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      const allowedText = '中あA1 _-@#+'
      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue(allowedText)
      await nextTick()

      expect(input.element.value).toBe(allowedText)

      await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
      await nextTick()

      expect(three.generateTextPreview).toHaveBeenCalledWith(allowedText, 4, 2)
      expect(toastWarnSpy).not.toHaveBeenCalled()
    })

    it('accepts Bopomofo text input for preview generation', async () => {
      const three = makeThree()
      const { wrapper, modelStore } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      const bopomofoText = 'ㄅㄇㄆㄑˊ˙'
      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue(bopomofoText)
      await nextTick()

      expect(input.element.value).toBe(bopomofoText)

      await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
      await nextTick()

      expect(three.generateTextPreview).toHaveBeenCalledWith(bopomofoText, 4, 2)
      expect(toastWarnSpy).not.toHaveBeenCalled()
    })

    it('retains unsupported characters, shows inline validation, and blocks preview without toast', async () => {
      const three = makeThree()
      const { wrapper, modelStore, t } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue('A🙂$한B')
      await nextTick()

      expect(input.element.value).toBe('A🙂$한B')
      expect(wrapper.find('[data-testid="text-validation-errors"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="text-validation-errors"]').text())
        .toContain(t('validation.textEmboss.unsupportedCharacters'))
      expect(toastWarnSpy).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="generate-preview-btn"]').attributes('disabled')).toBeDefined()

      await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
      await nextTick()

      expect(three.generateTextPreview).not.toHaveBeenCalled()
    })

    it('retains mixed unsupported and over-limit input and shows both inline validation messages', async () => {
      const three = makeThree()
      const { wrapper, modelStore, t } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue('漢漢漢漢漢🙂A')
      await nextTick()

      expect(input.element.value).toBe('漢漢漢漢漢🙂A')
      const validationText = wrapper.find('[data-testid="text-validation-errors"]').text()
      expect(validationText).toContain(t('validation.textEmboss.unsupportedCharacters'))
      expect(validationText).toContain(t('validation.textEmboss.charLimitReached'))
      expect(toastWarnSpy).not.toHaveBeenCalled()
    })

    it('does not render a visible character counter', async () => {
      const three = makeThree()
      const { wrapper, modelStore } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      expect(wrapper.find('[data-testid="char-counter"]').exists()).toBe(false)
    })

    it('retains input that exceeds full-width limit of 5 and blocks preview without toast', async () => {
      const three = makeThree()
      const { wrapper, modelStore, t } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      // 6 CJK chars = 6.0, exceeds limit
      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue('六个汉字超限制')
      await nextTick()

      expect(input.element.value).toBe('六个汉字超限制')
      expect(wrapper.find('[data-testid="text-validation-errors"]').text())
        .toContain(t('validation.textEmboss.charLimitReached'))
      expect(toastWarnSpy).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="generate-preview-btn"]').attributes('disabled')).toBeDefined()
    })

    it('shows inline char limit warning when limit is reached', async () => {
      const three = makeThree()
      const { wrapper, modelStore, t } = createWrapper(three, pinia)
      modelStore.models.push({ uuid: 'u1', name: 'M' })
      await nextTick()

      const input = wrapper.find('[data-testid="text-input"]')
      await input.setValue('株式会社A') // 4×1 + 0.6 = 4.6, within limit
      await input.setValue('株式会社AB') // 4×1 + 2×0.6 = 5.2, exceeds
      await nextTick()

      expect(input.element.value).toBe('株式会社AB')
      expect(wrapper.find('[data-testid="text-validation-errors"]').text())
        .toContain(t('validation.textEmboss.charLimitReached'))
      expect(toastWarnSpy).not.toHaveBeenCalled()
    })
  })

  it('blank / whitespace-only input does not enable preview button', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('   ')
    await nextTick()

    const previewBtn = wrapper.find('[data-testid="generate-preview-btn"]')
    expect(previewBtn.attributes('disabled')).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// Task 2.3 – Text size and depth inputs: defaults and clamping
// ---------------------------------------------------------------------------
describe('2.3 – Text size and depth inputs', () => {
  it('initializes text size to 4mm', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const sizeInput = wrapper.find('[data-testid="text-size-input"]')
    expect(sizeInput.element.value).toBe('4')
  })

  it('initializes depth to 2mm', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const depthInput = wrapper.find('[data-testid="depth-input"]')
    expect(depthInput.element.value).toBe('2')
  })

  it('clamps text size to 1mm when value is below minimum', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const sizeInput = wrapper.find('[data-testid="text-size-input"]')
    await sizeInput.setValue(0)
    await nextTick()

    expect(wrapper.find('[data-testid="text-size-input"]').element.value).toBe('1')
  })

  it('clamps text size to 20mm when value exceeds maximum', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const sizeInput = wrapper.find('[data-testid="text-size-input"]')
    await sizeInput.setValue(25)
    await nextTick()

    expect(wrapper.find('[data-testid="text-size-input"]').element.value).toBe('20')
  })

  it('clamps depth to 0.5mm when value is below minimum', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const depthInput = wrapper.find('[data-testid="depth-input"]')
    await depthInput.setValue(0)
    await nextTick()

    expect(wrapper.find('[data-testid="depth-input"]').element.value).toBe('0.5')
  })

  it('clamps depth to 5mm when value exceeds maximum', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const depthInput = wrapper.find('[data-testid="depth-input"]')
    await depthInput.setValue(10)
    await nextTick()

    expect(wrapper.find('[data-testid="depth-input"]').element.value).toBe('5')
  })
})

// ---------------------------------------------------------------------------
// Task 2.5 – Generate Preview button state
// ---------------------------------------------------------------------------
describe('2.5 – Generate Preview button state', () => {
  it('is disabled when text is empty', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const btn = wrapper.find('[data-testid="generate-preview-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('is enabled when text is non-empty and model exists', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('Test')
    await nextTick()

    const btn = wrapper.find('[data-testid="generate-preview-btn"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('is disabled when model does not exist even if text is non-empty', async () => {
    const three = makeThree()
    const { wrapper } = createWrapper(three, pinia)
    // no model added

    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('Test')
    await nextTick()

    const btn = wrapper.find('[data-testid="generate-preview-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('shows loading state and becomes disabled while preview generation is in progress', async () => {
    let resolvePreview
    const three = makeThree({
      generateTextPreview: vi.fn().mockImplementation(() => new Promise((resolve) => {
        resolvePreview = resolve
      })),
    })
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    await wrapper.find('[data-testid="text-input"]').setValue('Test')
    await nextTick()

    const btn = wrapper.find('[data-testid="generate-preview-btn"]')
    await btn.trigger('click')
    await nextTick()

    expect(wrapper.find('[data-testid="generate-preview-btn"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="generate-preview-btn"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.find('[data-testid="generate-preview-spinner"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="generate-preview-btn"]').text()).toContain('Generating text preview')

    resolvePreview()
    await nextTick()
    await nextTick()

    expect(wrapper.find('[data-testid="generate-preview-btn"]').attributes('aria-busy')).toBe('false')
    expect(wrapper.find('[data-testid="generate-preview-spinner"]').exists()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Task 2.7 – Emboss button state
// ---------------------------------------------------------------------------
describe('2.7 – Emboss button state', () => {
  it('is disabled when position has not been confirmed', async () => {
    const three = makeThree({ isTextPositionConfirmed: vi.fn().mockReturnValue(false) })
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const btn = wrapper.find('[data-testid="emboss-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()
  })

  it('is enabled after position is confirmed', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    // Simulate position confirmation via callback registered on mount
    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    expect(callback).toBeTypeOf('function')
    callback(true)
    await nextTick()

    const btn = wrapper.find('[data-testid="emboss-btn"]')
    expect(btn.attributes('disabled')).toBeUndefined()
  })

  it('is disabled after position is confirmed when text input is invalid', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    callback(true)
    await wrapper.find('[data-testid="text-input"]').setValue('文字🙂')
    await nextTick()

    const btn = wrapper.find('[data-testid="emboss-btn"]')
    expect(btn.attributes('disabled')).toBeDefined()

    await btn.trigger('click')
    await nextTick()

    expect(embossTextSpy).not.toHaveBeenCalled()
  })

  it('is disabled while emboss processing is in progress', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    callback(true)
    await nextTick()

    // Trigger emboss (will be processing due to mock promise not resolving immediately)
    const btn = wrapper.find('[data-testid="emboss-btn"]')
    expect(btn.attributes('disabled')).toBeUndefined() // enabled before click

    // Click to start processing
    const textInput = wrapper.find('[data-testid="text-input"]')
    await textInput.setValue('Test')
    await nextTick()

    // Check that button shows loading state while processing
    let resolveModelExport
    three.exportModelAsStl = vi.fn(() => new Promise((resolve) => {
      resolveModelExport = resolve
    }))
    await btn.trigger('click')
    await nextTick()

    // After click, isProcessing = true, button should be disabled
    expect(wrapper.find('[data-testid="emboss-btn"]').attributes('disabled')).toBeDefined()

    resolveModelExport(new Blob())
    await nextTick()
    await nextTick()
  })
})

// ---------------------------------------------------------------------------
// Task 3.1 – Preview generation
// ---------------------------------------------------------------------------
describe('3.1 – Preview generation', () => {
  it('calls generateTextPreview with correct args when button is clicked', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('Hello')
    await nextTick()

    const btn = wrapper.find('[data-testid="generate-preview-btn"]')
    await btn.trigger('click')
    await nextTick()

    expect(three.generateTextPreview).toHaveBeenCalledWith('Hello', 4, 2)
  })

  it('calls generateTextPreview again (replacing old preview) when re-generated', async () => {
    const three = makeThree()
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('First')
    await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
    await nextTick()

    await input.setValue('Second')
    await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
    await nextTick()

    expect(three.generateTextPreview).toHaveBeenCalledTimes(2)
    expect(three.generateTextPreview).toHaveBeenLastCalledWith('Second', 4, 2)
  })
})

// ---------------------------------------------------------------------------
// Task 3.3 – Parameter updates trigger preview re-generation
// ---------------------------------------------------------------------------
describe('3.3 – Parameter updates re-generate preview', () => {
  async function setupWithPreview(three, pinia) {
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'u1', name: 'M' })
    await nextTick()

    const input = wrapper.find('[data-testid="text-input"]')
    await input.setValue('Test')
    await wrapper.find('[data-testid="generate-preview-btn"]').trigger('click')
    await nextTick()

    three.generateTextPreview.mockClear()
    three.isTextPreviewActive = vi.fn().mockReturnValue(true)
    return wrapper
  }

  it('updates preview when text size changes (after preview is active)', async () => {
    const three = makeThree()
    const wrapper = await setupWithPreview(three, pinia)

    const sizeInput = wrapper.find('[data-testid="text-size-input"]')
    await sizeInput.setValue(15)
    await nextTick()

    // Should call updateTextPreviewParams or generateTextPreview with new size
    const updated
      = three.updateTextPreviewParams.mock.calls.length > 0
        || three.generateTextPreview.mock.calls.length > 0
    expect(updated).toBe(true)
  })

  it('updates preview when depth changes (after preview is active)', async () => {
    const three = makeThree()
    const wrapper = await setupWithPreview(three, pinia)

    const depthInput = wrapper.find('[data-testid="depth-input"]')
    await depthInput.setValue(3)
    await nextTick()

    const updated
      = three.updateTextPreviewParams.mock.calls.length > 0
        || three.generateTextPreview.mock.calls.length > 0
    expect(updated).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Emboss backend job routing
// ---------------------------------------------------------------------------
describe('emboss backend job routing', () => {
  it('passes the selected model ortho jobId to embossText when available', async () => {
    const selectedObject = { uuid: 'model-1' }
    const three = makeThree({
      getSelectedObject: vi.fn().mockReturnValue(selectedObject),
      exportModelAsStl: vi.fn().mockReturnValue(new Blob(['model'])),
      exportTextMeshAsStl: vi.fn().mockReturnValue(new Blob(['text'])),
    })
    const { wrapper, modelStore, backendStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'model-1', name: 'M' })
    backendStore.setOrthoResultSource('model-1', '989e90de')
    await nextTick()

    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    callback(true)
    await nextTick()

    await wrapper.find('[data-testid="text-input"]').setValue('文字')
    await nextTick()
    await wrapper.find('[data-testid="emboss-btn"]').trigger('click')
    await nextTick()

    expect(embossTextSpy).toHaveBeenCalledWith(expect.objectContaining({
      parentJobId: '989e90de',
    }))
    expect(three.replaceModelGeometry).toHaveBeenCalledWith(
      selectedObject,
      expect.any(Blob),
      'common.commandLabels.textEmboss',
    )
  })

  it('commits geometry replacement and preview clearing as one undo transaction', async () => {
    const selectedObject = { uuid: 'model-1' }
    const callOrder = []
    const three = makeThree({
      getSelectedObject: vi.fn().mockReturnValue(selectedObject),
      exportModelAsStl: vi.fn().mockReturnValue(new Blob(['model'])),
      exportTextMeshAsStl: vi.fn().mockReturnValue(new Blob(['text'])),
      beginTransaction: vi.fn(() => callOrder.push('begin')),
      replaceModelGeometry: vi.fn().mockImplementation(async () => callOrder.push('replace')),
      clearTextPreviewWithUndo: vi.fn(() => callOrder.push('clear')),
      commitTransaction: vi.fn(() => callOrder.push('commit')),
      clearTextPreview: vi.fn(() => callOrder.push('clear-fallback')),
    })
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'model-1', name: 'M' })
    await nextTick()

    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    callback(true)
    await nextTick()

    await wrapper.find('[data-testid="text-input"]').setValue('文字')
    await nextTick()
    await wrapper.find('[data-testid="emboss-btn"]').trigger('click')
    await nextTick()

    expect(callOrder).toEqual(['begin', 'replace', 'clear', 'commit'])
    expect(three.beginTransaction).toHaveBeenCalledWith('common.commandLabels.textEmboss')
    expect(three.clearTextPreview).not.toHaveBeenCalled()
    expect(three.rollbackTransaction).not.toHaveBeenCalled()
  })

  it('falls back to creating an unparented boolean job when no source jobId exists', async () => {
    const selectedObject = { uuid: 'model-2' }
    const three = makeThree({
      getSelectedObject: vi.fn().mockReturnValue(selectedObject),
      exportModelAsStl: vi.fn().mockReturnValue(new Blob(['model'])),
      exportTextMeshAsStl: vi.fn().mockReturnValue(new Blob(['text'])),
    })
    const { wrapper, modelStore } = createWrapper(three, pinia)
    modelStore.models.push({ uuid: 'model-2', name: 'M' })
    await nextTick()

    const callback = three.setTextPositionConfirmedCallback.mock.calls[0]?.[0]
    callback(true)
    await nextTick()

    await wrapper.find('[data-testid="text-input"]').setValue('文字')
    await nextTick()
    await wrapper.find('[data-testid="emboss-btn"]').trigger('click')
    await nextTick()

    expect(embossTextSpy).toHaveBeenCalledWith(expect.objectContaining({
      parentJobId: '',
    }))
  })
})

// ---------------------------------------------------------------------------
// Task 9.2 – Transform / drag control disabling during panel lifetime
// ---------------------------------------------------------------------------
describe('9.2 – Transform / drag control lifecycle', () => {
  it('calls setTextEmbossMode(true) when the panel mounts', () => {
    const three = makeThree({ setTextEmbossMode: vi.fn() })
    createWrapper(three, pinia)

    expect(three.setTextEmbossMode).toHaveBeenCalledWith(true)
  })

  it('calls setTextEmbossMode(false) when the panel unmounts', async () => {
    const three = makeThree({ setTextEmbossMode: vi.fn() })
    const { wrapper } = createWrapper(three, pinia)

    await wrapper.unmount()

    expect(three.setTextEmbossMode).toHaveBeenCalledWith(false)
  })

  it('clears the text preview mesh when the panel unmounts', async () => {
    const three = makeThree({
      setTextEmbossMode: vi.fn(),
      clearTextPreview: vi.fn(),
    })
    const { wrapper } = createWrapper(three, pinia)

    await wrapper.unmount()

    expect(three.clearTextPreview).toHaveBeenCalledTimes(1)
  })

  it('does not throw when three does not expose setTextEmbossMode', () => {
    // three without setTextEmbossMode — should mount/unmount without error
    const three = makeThree()
    expect(() => createWrapper(three, pinia)).not.toThrow()
  })
})
