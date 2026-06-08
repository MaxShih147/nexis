import enMessages from '@/i18n/locales/en.json'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import ModelEditor from '../ModelEditor.vue'

const mountedWrappers = []

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    icon: String,
    pt: Object,
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h(
      'button',
      {
        'type': 'button',
        'data-icon': props.icon,
        'class': props.pt?.root?.class,
        'onClick': () => emit('click'),
      },
      slots.default?.(),
    )
  },
})

const EditorPanelStub = defineComponent({
  name: 'EditorPanel',
  setup(_props, { slots }) {
    return () => h('div', [slots['header-btn']?.(), slots.default?.(), slots.body?.()])
  },
})

const ModelEditorFieldRowStub = defineComponent({
  name: 'ModelEditorFieldRow',
  setup(_props, { slots }) {
    return () => h('div', [slots.start?.(), slots.mid?.(), slots.end?.()])
  },
})

const SteppedInputStub = defineComponent({
  name: 'SteppedInput',
  props: {
    modelValue: [String, Number],
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      value: props.modelValue,
      onInput: event => emit('update:modelValue', event.target.value),
    })
  },
})

const CheckboxStub = defineComponent({
  name: 'Checkbox',
  props: {
    modelValue: Boolean,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () => h('input', {
      type: 'checkbox',
      checked: props.modelValue,
      onChange: event => emit('update:modelValue', event.target.checked),
    })
  },
})

const DividerStub = defineComponent({
  name: 'VDivider',
  setup() {
    return () => h('hr')
  },
})

function createWrapper(threeOverrides = {}) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })
  const pinia = createPinia()
  let modeChangeHandler = null
  const threeMock = {
    isLayOnFaceModeActive: vi.fn().mockReturnValue(false),
    isFaceOnTopModeActive: vi.fn().mockReturnValue(false),
    isFaceSelectionModeActive: vi.fn().mockReturnValue(false),
    setLayOnFaceMode: vi.fn(),
    setFaceOnTopMode: vi.fn(),
    setFaceSelectionMode: vi.fn(),
    setToBottom: vi.fn(),
    setToCenter: vi.fn(),
    updatePosition: vi.fn(),
    updateRotation: vi.fn(),
    updateScale: vi.fn(),
    expandModel: vi.fn(),
    mirrorModel: vi.fn(),
    subscribeFaceSelectionModeChange: vi.fn((handler) => {
      modeChangeHandler = handler
      return () => {
        modeChangeHandler = null
      }
    }),
    ...threeOverrides,
  }

  const wrapper = mount(ModelEditor, {
    global: {
      plugins: [i18n, pinia],
      provide: {
        three: threeMock,
      },
      stubs: {
        Button: ButtonStub,
        EditorPanel: EditorPanelStub,
        ModelEditorFieldRow: ModelEditorFieldRowStub,
        SteppedInput: SteppedInputStub,
        Checkbox: CheckboxStub,
        VDivider: DividerStub,
      },
    },
  })
  mountedWrappers.push(wrapper)

  return {
    wrapper,
    threeMock,
    triggerModeChange: state => modeChangeHandler?.(state),
  }
}

afterEach(async () => {
  while (mountedWrappers.length) {
    const wrapper = mountedWrappers.pop()
    await wrapper.unmount()
  }
})

function findButton(wrapper, icon) {
  return wrapper.find(`button[data-icon="${icon}"]`)
}

describe('modelEditor rotation mode buttons', () => {
  it('starts lay-on-face mode and highlights the button', async () => {
    const { wrapper, threeMock } = createWrapper()
    const layButton = findButton(wrapper, 'icon-[lucide--mouse-pointer-square]')

    expect(layButton.exists()).toBe(true)
    expect(layButton.classes()).toContain('!text-zinc-400')

    await layButton.trigger('click')
    await nextTick()

    expect(layButton.classes()).toContain('!text-primary-400')
    expect(threeMock.setLayOnFaceMode).toHaveBeenCalledWith(true)
    expect(threeMock.setFaceOnTopMode).toHaveBeenCalledWith(false)

    await layButton.trigger('click')
    await nextTick()

    expect(layButton.classes()).toContain('!text-zinc-400')
    expect(threeMock.setLayOnFaceMode).toHaveBeenLastCalledWith(false)
  })

  it('activating face-on-top disables lay-on-face and can be toggled off', async () => {
    const { wrapper, threeMock } = createWrapper()
    const layButton = findButton(wrapper, 'icon-[lucide--mouse-pointer-square]')
    const faceOnTopButton = findButton(wrapper, 'icon-[lucide--arrow-up]')

    expect(layButton.exists()).toBe(true)
    expect(faceOnTopButton.exists()).toBe(true)

    await layButton.trigger('click')
    await nextTick()

    expect(layButton.classes()).toContain('!text-primary-400')

    await faceOnTopButton.trigger('click')
    await nextTick()

    expect(faceOnTopButton.classes()).toContain('!text-primary-400')
    expect(layButton.classes()).toContain('!text-zinc-400')
    expect(threeMock.setFaceOnTopMode).toHaveBeenCalledWith(true)
    expect(threeMock.setLayOnFaceMode).toHaveBeenCalledWith(false)

    await faceOnTopButton.trigger('click')
    await nextTick()

    expect(faceOnTopButton.classes()).toContain('!text-zinc-400')
    expect(threeMock.setFaceOnTopMode).toHaveBeenLastCalledWith(false)
  })

  it('updates button state when mode change event fires', async () => {
    const { wrapper, threeMock, triggerModeChange } = createWrapper()
    const layButton = findButton(wrapper, 'icon-[lucide--mouse-pointer-square]')
    const faceOnTopButton = findButton(wrapper, 'icon-[lucide--arrow-up]')

    expect(threeMock.subscribeFaceSelectionModeChange).toHaveBeenCalled()

    triggerModeChange({ isLayOnFaceModeActive: true, isFaceOnTopModeActive: false })
    await nextTick()
    expect(layButton.classes()).toContain('!text-primary-400')
    expect(faceOnTopButton.classes()).toContain('!text-zinc-400')

    triggerModeChange({ isLayOnFaceModeActive: false, isFaceOnTopModeActive: true })
    await nextTick()
    expect(faceOnTopButton.classes()).toContain('!text-primary-400')
    expect(layButton.classes()).toContain('!text-zinc-400')

    triggerModeChange({ isLayOnFaceModeActive: false, isFaceOnTopModeActive: false })
    await nextTick()
    expect(faceOnTopButton.classes()).toContain('!text-zinc-400')
    expect(layButton.classes()).toContain('!text-zinc-400')
  })
})
