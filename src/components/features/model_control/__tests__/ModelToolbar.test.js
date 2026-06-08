import enMessages from '@/i18n/locales/en.json'
import { useModelStore } from '@/stores/model'
import { useParamsStore } from '@/stores/useParamsStore'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, onBeforeUnmount, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import ModelToolbar from '../ModelToolbar.vue'

const toastMocks = vi.hoisted(() => ({
  infoKey: vi.fn(),
  errorKey: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMocks,
}))

const popoverHideSpy = vi.fn()
const popoverToggleSpy = vi.fn()
const mountedWrappers = []

const ToolbarButtonStub = defineComponent({
  name: 'ToolbarButton',
  inheritAttrs: false,
  props: {
    icon: String,
    tooltip: String,
    active: Boolean,
    disabled: Boolean,
  },
  emits: ['click'],
  setup(props, { emit, attrs }) {
    return () =>
      h(
        'button',
        {
          ...attrs,
          type: 'button',
          disabled: props.disabled,
          onClick: event => !props.disabled && emit('click', event),
        },
      )
  },
})

const PopoverStub = defineComponent({
  name: 'Popover',
  props: {
    dismissable: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['show', 'hide'],
  setup(props, { emit, slots }) {
    const visible = ref(false)
    const container = document.createElement('div')
    container.dataset.testid = 'popover-container'
    document.body.appendChild(container)

    function show() {
      if (visible.value)
        return
      visible.value = true
      emit('show')
    }

    function hide() {
      if (!visible.value)
        return
      popoverHideSpy()
      visible.value = false
      emit('hide')
    }

    function toggle() {
      popoverToggleSpy()
      if (visible.value)
        hide()
      else
        show()
    }

    onBeforeUnmount(() => {
      container.remove()
    })

    return {
      visible,
      container,
      hide,
      toggle,
      slots,
    }
  },
  template: `
    <div class="popover-stub">
      <div v-show="visible">
        <slot />
      </div>
    </div>
  `,
})

function getTextEmbossPopover(wrapper) {
  return wrapper.findAllComponents({ name: 'Popover' }).find(popover =>
    popover.findComponent({ name: 'TextEmbossEditor' }).exists(),
  )
}

function createWrapper({ models = [] } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const modelStore = useModelStore()
  const paramsStore = useParamsStore()
  modelStore.clearAll()
  for (const model of models) {
    modelStore.addModel(model, model.name)
  }
  paramsStore.applyResin({ __dental_mode: 'ORTHODONTIC_MODEL' }, { preserveUserEdits: false, markDirty: false })

  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: enMessages },
  })

  const sceneElement = document.createElement('canvas')
  const otherUiElement = document.createElement('button')
  document.body.appendChild(sceneElement)
  document.body.appendChild(otherUiElement)

  const wrapper = mount(ModelToolbar, {
    attachTo: document.body,
    global: {
      plugins: [pinia, i18n],
      provide: {
        three: {
          hasSupportMesh: vi.fn().mockReturnValue(false),
          getSelectedObject: vi.fn().mockReturnValue(null),
          getDomElement: vi.fn().mockReturnValue(sceneElement),
          setTransformMode: vi.fn(),
          undoManager: {
            undo: vi.fn(),
            redo: vi.fn(),
          },
        },
      },
      stubs: {
        ToolbarButton: ToolbarButtonStub,
        VDivider: true,
        UploadBtn: true,
        ToothLoadingDialog: true,
        BaseGenerationPanel: true,
        DrillEditor: true,
        HollowEditor: true,
        OrthoProcessingEditor: true,
        TextEmbossEditor: true,
        Popover: PopoverStub,
      },
    },
  })
  mountedWrappers.push(wrapper)

  return { wrapper, sceneElement, otherUiElement }
}

describe('modelToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  afterEach(async () => {
    while (mountedWrappers.length) {
      const wrapper = mountedWrappers.pop()
      await wrapper.unmount()
    }
    document.body.innerHTML = ''
  })

  it('configures the text emboss popover to manage dismissal manually', () => {
    const { wrapper } = createWrapper()

    const popovers = wrapper.findAllComponents({ name: 'Popover' })
    expect(popovers).toHaveLength(5)
    expect(getTextEmbossPopover(wrapper)?.props('dismissable')).toBe(false)
  })

  it('keeps the text emboss panel open when clicking the 3D scene', async () => {
    const { wrapper, sceneElement } = createWrapper()
    const textEmbossButton = wrapper.find('[data-testid="text-emboss-trigger"]')
    await textEmbossButton.trigger('click')
    await nextTick()

    const textEmbossPopover = getTextEmbossPopover(wrapper)
    expect(textEmbossPopover?.vm.visible).toBe(true)

    sceneElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(popoverHideSpy).not.toHaveBeenCalled()
    expect(textEmbossPopover?.vm.visible).toBe(true)
  })

  it('hides the text emboss panel when clicking other UI', async () => {
    const { wrapper, otherUiElement } = createWrapper()
    const textEmbossButton = wrapper.find('[data-testid="text-emboss-trigger"]')
    await textEmbossButton.trigger('click')
    await nextTick()

    const textEmbossPopover = getTextEmbossPopover(wrapper)
    expect(textEmbossPopover?.vm.visible).toBe(true)

    otherUiElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    expect(popoverHideSpy).toHaveBeenCalled()
    expect(textEmbossPopover?.vm.visible).toBe(false)
  })

  it('can re-open the text emboss panel from the entry button after outside-close', async () => {
    const { wrapper, otherUiElement } = createWrapper()
    const textEmbossButton = wrapper.find('[data-testid="text-emboss-trigger"]')

    await textEmbossButton.trigger('click')
    await nextTick()

    otherUiElement.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await nextTick()

    await textEmbossButton.trigger('click')
    await nextTick()

    const textEmbossPopover = getTextEmbossPopover(wrapper)
    expect(popoverToggleSpy).toHaveBeenCalledTimes(2)
    expect(textEmbossPopover?.vm.visible).toBe(true)
  })

  it('hides the text emboss panel when a toolbar mode button is clicked', async () => {
    const { wrapper } = createWrapper()
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-testid="text-emboss-trigger"]').trigger('click')
    await nextTick()

    const { tools } = wrapper.vm
    tools.basicControls[0].action(new MouseEvent('click'))

    expect(popoverHideSpy).toHaveBeenCalled()
  })

  it('shows an import-model error toast instead of disabling the base generation entry when no model exists', async () => {
    const { wrapper } = createWrapper()
    const button = wrapper.find('[data-base-generation-entry="true"]')

    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')

    expect(toastMocks.errorKey).toHaveBeenCalledWith('common.messages.importModelFirst')
  })

  it('keeps the base generation entry enabled after a model is present', () => {
    const { wrapper } = createWrapper({
      models: [{ uuid: 'model-1', name: 'Model 1' }],
    })
    const button = wrapper.find('[data-base-generation-entry="true"]')

    expect(button.attributes('disabled')).toBeUndefined()
  })
})
