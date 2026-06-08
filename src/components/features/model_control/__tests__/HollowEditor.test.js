import enMessages from '@/i18n/locales/en.json'
import { useModelStore } from '@/stores/model'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import HollowEditor from '../HollowEditor.vue'

const SteppedInputStub = defineComponent({
  name: 'SteppedInput',
  props: { modelValue: [String, Number], min: Number, max: Number, step: Number, type: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', { value: props.modelValue, onInput: e => emit('update:modelValue', e.target.value) })
  },
})

const ButtonStub = defineComponent({
  name: 'Button',
  props: { label: String, loading: Boolean },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', { 'data-label': props.label, 'onClick': () => emit('click') }, props.label)
  },
})

const toastErrorSpy = vi.fn()
const toastSuccessSpy = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: toastErrorSpy,
    success: toastSuccessSpy,
    errorKey: vi.fn(),
    successKey: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  }),
}))

function makeThree(overrides = {}) {
  return {
    hollowParams: { voxelSize: 1, radius: 1, resolution: 512 },
    setHollowMode: vi.fn(),
    closeHollowMode: vi.fn(),
    updateHollowParams: vi.fn(),
    hollow: vi.fn().mockResolvedValue(true),
    restoreHollow: vi.fn(),
    ...overrides,
  }
}

function createWrapper(three) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })
  const pinia = createPinia()
  setActivePinia(pinia)

  const wrapper = mount(HollowEditor, {
    global: {
      plugins: [i18n, pinia],
      provide: { three },
      stubs: { SteppedInput: SteppedInputStub, Button: ButtonStub },
    },
  })

  return { wrapper, modelStore: useModelStore(), t: i18n.global.t }
}

describe('hollowEditor catch-path toast keys', () => {
  beforeEach(() => {
    toastErrorSpy.mockClear()
    toastSuccessSpy.mockClear()
  })

  it('uses hollowFailed key when hollow() throws', async () => {
    const three = makeThree({
      hollow: vi.fn().mockRejectedValue(new Error('internal error')),
    })
    const { wrapper, modelStore, t } = createWrapper(three)

    // Object3D must be non-null so hollow() doesn't early-return
    modelStore.selectedModel.Object3D = {}
    await wrapper.vm.$nextTick()

    await wrapper.find('button').trigger('click')
    await new Promise(r => setTimeout(r, 30))

    expect(toastErrorSpy).toHaveBeenCalledWith(t('common.messages.hollowFailed'))
  })

  it('uses restoreHollowFailed key when restoreHollow() throws', async () => {
    const three = makeThree({
      restoreHollow: vi.fn().mockImplementation(() => { throw new Error('restore error') }),
    })
    const { wrapper, modelStore, t } = createWrapper(three)

    // Set hollowed + Object3D so restore path is enabled
    modelStore.selectedModel.hollowed = true
    modelStore.selectedModel.Object3D = {}
    await wrapper.vm.$nextTick()

    await wrapper.find('button').trigger('click')

    expect(toastErrorSpy).toHaveBeenCalledWith(t('common.messages.restoreHollowFailed'))
  })
})
