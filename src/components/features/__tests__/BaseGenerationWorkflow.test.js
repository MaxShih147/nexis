import enMessages from '@/i18n/locales/en.json'
import twMessages from '@/i18n/locales/tw.json'
import { useModelStore } from '@/stores/model'
import { useParamsStore } from '@/stores/useParamsStore'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { BoxGeometry, Mesh, MeshBasicMaterial } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import BaseGenerationPanel from '../BaseGenerationPanel.vue'
import ModelToolbar from '../model_control/ModelToolbar.vue'

const backendMocks = vi.hoisted(() => ({
  detectBoundary: vi.fn(),
  smoothBoundary: vi.fn(),
  applyBoundary: vi.fn(),
  generateBase: vi.fn(),
}))

vi.mock('@/axios/backendService', () => backendMocks)

const meshTrimmerMocks = vi.hoisted(() => ({
  autoOrientModel: vi.fn(() => ({ rotated: true, boundaryTransformMatrix: { isMatrix4: true } })),
  transformLoopPoints: vi.fn(loops => loops),
  conformMeshToBoundary: vi.fn(geometry => geometry.clone()),
  trimMeshAlongBoundary: vi.fn(geometry => geometry.clone()),
}))

vi.mock('@/three/meshTrimmer', () => meshTrimmerMocks)

const toastMocks = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  errorKey: vi.fn(),
  successKey: vi.fn(),
  infoKey: vi.fn(),
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => toastMocks,
}))

const ToolbarButtonStub = defineComponent({
  name: 'ToolbarButton',
  props: {
    icon: String,
    label: String,
    tooltip: String,
    active: Boolean,
    disabled: Boolean,
  },
  emits: ['click'],
  setup(props, { emit }) {
    return () => h('button', {
      'type': 'button',
      'title': props.tooltip,
      'disabled': props.disabled,
      'data-icon': props.icon,
      'data-label': props.label,
      'onClick': event => emit('click', event),
    }, props.label || props.tooltip || props.icon)
  },
})

const PopoverStub = defineComponent({
  name: 'Popover',
  props: {
    dismissable: Boolean,
    pt: Object,
  },
  setup(_props, { expose, slots }) {
    const visible = ref(false)
    const alignOverlay = vi.fn()
    expose({
      toggle: () => { visible.value = !visible.value },
      show: () => { visible.value = true },
      hide: () => { visible.value = false },
      alignOverlay,
    })
    return () => visible.value ? h('div', { class: 'popover-stub' }, slots.default?.()) : null
  },
})

const DialogStub = defineComponent({
  name: 'Dialog',
  props: {
    visible: Boolean,
  },
  setup(props, { slots }) {
    return () => props.visible ? h('div', { class: 'dialog-stub p-dialog' }, slots.default?.()) : null
  },
})

const ToothLoadingDialogStub = defineComponent({
  name: 'ToothLoadingDialog',
  props: {
    visible: Boolean,
    messages: Array,
  },
  setup(props) {
    return () => props.visible
      ? h('div', { 'data-test': 'tooth-loading-dialog' }, props.messages?.[0] || 'Loading...')
      : null
  },
})

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    label: String,
    disabled: Boolean,
    type: String,
  },
  emits: ['click'],
  setup(props, { attrs, emit }) {
    return () => h('button', {
      ...attrs,
      type: props.type || 'button',
      disabled: props.disabled,
      onClick: event => emit('click', event),
    }, props.label)
  },
})

function createI18nForTests(locale = 'en') {
  return createI18n({
    legacy: false,
    locale,
    messages: {
      en: enMessages,
      tw: twMessages,
    },
  })
}

function makeModel() {
  const mesh = new Mesh(new BoxGeometry(2, 2, 2), new MeshBasicMaterial())
  mesh.name = 'test-model'
  mesh.position.set(1, 2, 3)
  return mesh
}

function makeThree(overrides = {}) {
  const canvas = document.createElement('canvas')
  const model = makeModel()
  return {
    getDomElement: vi.fn(() => canvas),
    getModels: vi.fn(() => [model]),
    getSelectedObject: vi.fn(() => model),
    selectModel: vi.fn(),
    autoOrient: vi.fn(async (target) => {
      target.rotation.x = 0.5
      target.position.z = 0
    }),
    exportBinarySTL: vi.fn(() => new Blob(['stl'])),
    replaceModelGeometry: vi.fn(async (target) => {
      target.geometry = new BoxGeometry(3, 3, 3)
    }),
    getScene: vi.fn(() => ({ add: vi.fn(), remove: vi.fn() })),
    getCamera: vi.fn(() => ({})),
    setOrbitEnabled: vi.fn(),
    setDragEnabled: vi.fn(),
    setTransformMode: vi.fn(),
    render: vi.fn(),
    hasSupportMesh: vi.fn(() => false),
    undoManager: { undo: vi.fn(), redo: vi.fn(), canUndo: false, canRedo: false },
    ...overrides,
    model,
    canvas,
  }
}

function mountBaseGenerationPanel({ three = makeThree(), locale = 'en' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18nForTests(locale)
  const wrapper = mount(BaseGenerationPanel, {
    global: {
      plugins: [pinia, i18n],
      provide: { three },
      stubs: {
        Button: ButtonStub,
        Dialog: DialogStub,
      },
    },
  })
  return { wrapper, three, t: i18n.global.t }
}

function mountToolbar({ three = makeThree(), locale = 'en', dentalMode = 'ORTHODONTIC_MODEL' } = {}) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const paramsStore = useParamsStore()
  const modelStore = useModelStore()
  modelStore.clearAll()
  for (const model of three.getModels()) {
    modelStore.addModel(model, model.name)
  }
  paramsStore.applyResin(dentalMode ? { __dental_mode: dentalMode } : null, { preserveUserEdits: false, markDirty: false })
  const i18n = createI18nForTests(locale)
  const wrapper = mount(ModelToolbar, {
    global: {
      plugins: [pinia, i18n],
      provide: { three },
      stubs: {
        ToolbarButton: ToolbarButtonStub,
        Popover: PopoverStub,
        ToothLoadingDialog: ToothLoadingDialogStub,
        Dialog: DialogStub,
        UploadBtn: true,
        DrillEditor: true,
        HollowEditor: true,
        OrthoProcessingEditor: true,
        VDivider: true,
        Button: ButtonStub,
      },
    },
  })
  return { wrapper, three, t: i18n.global.t }
}

async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

function installAnimationFrameMock() {
  return vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callback()
    return 1
  })
}

function createDeferred() {
  let resolve
  let reject
  const promise = new Promise((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, resolve, reject }
}

function mockSuccessfulBackend() {
  backendMocks.detectBoundary.mockResolvedValue({
    success: true,
    data: {
      main_loop_index: 0,
      loop_count: 1,
      loops: [{ is_main: true, points: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], vertex_count: 3 }],
    },
  })
  backendMocks.smoothBoundary.mockResolvedValue({
    success: true,
    data: { loops: [{ points: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] }] },
  })
  backendMocks.applyBoundary.mockResolvedValue(new Blob(['applied']))
  backendMocks.generateBase.mockResolvedValue(new Blob(['base']))
}

describe('base generation toolbar entry', () => {
  beforeEach(() => {
    backendMocks.detectBoundary.mockReset()
    backendMocks.smoothBoundary.mockReset()
    backendMocks.applyBoundary.mockReset()
    backendMocks.generateBase.mockReset()
    mockSuccessfulBackend()
    meshTrimmerMocks.autoOrientModel.mockClear()
    meshTrimmerMocks.transformLoopPoints.mockClear()
    meshTrimmerMocks.conformMeshToBoundary.mockClear()
    meshTrimmerMocks.trimMeshAlongBoundary.mockClear()
    toastMocks.error.mockReset()
    toastMocks.success.mockReset()
    toastMocks.warn.mockReset()
    toastMocks.info.mockReset()
    toastMocks.errorKey.mockReset()
    toastMocks.successKey.mockReset()
    toastMocks.infoKey.mockReset()
  })

  it('renders the base generation entry before auto process in dental mode', () => {
    const { wrapper, t } = mountToolbar()
    const buttons = wrapper.findAll('button')
    const titles = buttons.map(button => button.attributes('title'))

    expect(titles).toContain(t('common.labels.baseGeneration'))
    expect(titles.indexOf(t('common.labels.baseGeneration'))).toBeLessThan(titles.indexOf(t('common.tooltips.autoProcess')))
  })

  it('does not render the base generation entry outside dental mode', () => {
    const { wrapper } = mountToolbar({ dentalMode: null })

    expect(wrapper.find('.popover-stub').exists()).toBe(false)
  })

  it('shows an import-model error toast when no model exists', async () => {
    const three = makeThree({
      getModels: vi.fn(() => []),
      getSelectedObject: vi.fn(() => null),
    })
    const { wrapper } = mountToolbar({ three, locale: 'tw' })
    const button = wrapper.find(`button[data-icon="icon-[lucide--square-scissors]"]`)

    expect(button.attributes('title')).toBe('請先匯入模型')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')

    expect(toastMocks.errorKey).toHaveBeenCalledWith('common.messages.importModelFirst')
    expect(meshTrimmerMocks.autoOrientModel).not.toHaveBeenCalled()
  })

  it('shows the panel and tooth loading dialog before auto-orienting on entry click', async () => {
    const rafSpy = installAnimationFrameMock()
    const detectDeferred = createDeferred()
    backendMocks.detectBoundary.mockReturnValueOnce(detectDeferred.promise)
    const { wrapper, t } = mountToolbar()

    await wrapper.find(`button[title="${t('common.labels.baseGeneration')}"]`).trigger('click')
    await nextTick()

    expect(wrapper.find('.popover-stub').exists()).toBe(true)
    expect(wrapper.text()).toContain(t('common.labels.baseGeneration'))
    expect(wrapper.find('[data-test="tooth-loading-dialog"]').exists()).toBe(true)
    expect(meshTrimmerMocks.autoOrientModel).not.toHaveBeenCalled()

    detectDeferred.resolve({
      success: true,
      data: {
        main_loop_index: 0,
        loop_count: 1,
        loops: [{ is_main: true, points: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], vertex_count: 3 }],
      },
    })
    await flushPromises()

    expect(meshTrimmerMocks.autoOrientModel).toHaveBeenCalled()
    expect(wrapper.find('[data-test="tooth-loading-dialog"]').exists()).toBe(false)
    rafSpy.mockRestore()
  })

  it('keeps the panel open on 3D scene clicks and closes it on other UI clicks', async () => {
    const rafSpy = installAnimationFrameMock()
    const three = makeThree()
    const outsideUi = document.createElement('button')
    document.body.append(outsideUi)
    const { wrapper, t } = mountToolbar({ three })

    await wrapper.find(`button[title="${t('common.labels.baseGeneration')}"]`).trigger('click')
    await flushPromises()
    expect(wrapper.find('.popover-stub').exists()).toBe(true)

    three.canvas.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await nextTick()
    expect(wrapper.find('.popover-stub').exists()).toBe(true)

    outsideUi.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.popover-stub').exists()).toBe(false)

    outsideUi.remove()
    rafSpy.mockRestore()
  })

  it('preserves the generated base when the panel is closed from outside', async () => {
    const rafSpy = installAnimationFrameMock()
    const outsideUi = document.createElement('button')
    document.body.append(outsideUi)
    const three = makeThree()
    const { wrapper, t } = mountToolbar({ three })

    await wrapper.find(`button[title="${t('common.labels.baseGeneration')}"]`).trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()
    const callsAfterGenerate = three.replaceModelGeometry.mock.calls.length

    outsideUi.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await flushPromises()

    expect(wrapper.find('.popover-stub').exists()).toBe(false)
    expect(three.replaceModelGeometry.mock.calls.length).toBe(callsAfterGenerate)

    outsideUi.remove()
    rafSpy.mockRestore()
  })

  it('keeps the tooth loading dialog visible while generating a base', async () => {
    const rafSpy = installAnimationFrameMock()
    const applyDeferred = createDeferred()
    const generateDeferred = createDeferred()
    backendMocks.applyBoundary.mockReturnValueOnce(applyDeferred.promise)
    backendMocks.generateBase.mockReturnValueOnce(generateDeferred.promise)
    const { wrapper, t } = mountToolbar()

    await wrapper.find(`button[title="${t('common.labels.baseGeneration')}"]`).trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-test="tooth-loading-dialog"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="tooth-loading-dialog"]')).toHaveLength(1)

    applyDeferred.resolve(new Blob(['applied']))
    await flushPromises()

    expect(wrapper.find('[data-test="tooth-loading-dialog"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-test="tooth-loading-dialog"]')).toHaveLength(1)

    generateDeferred.resolve(new Blob(['base']))
    await flushPromises()

    expect(wrapper.find('[data-test="tooth-loading-dialog"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(true)
    rafSpy.mockRestore()
  })

  it('keeps the panel open when confirming re-adjust from the PrimeVue dialog', async () => {
    const rafSpy = installAnimationFrameMock()
    const { wrapper, t, three } = mountToolbar()

    await wrapper.find(`button[title="${t('common.labels.baseGeneration')}"]`).trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()
    const continueButton = wrapper.findAll('button').find(button => button.text() === 'Continue')

    expect(continueButton).toBeTruthy()

    continueButton.element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true }))
    await nextTick()
    await continueButton.trigger('click')
    await flushPromises()

    expect(wrapper.find('.popover-stub').exists()).toBe(true)
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="adjust-contour"]').text()).toBe('Cancel Adjustment')
    expect(three.setDragEnabled).toHaveBeenCalledWith(false)
    rafSpy.mockRestore()
  })
})

describe('base generation session lifecycle', () => {
  beforeEach(() => {
    backendMocks.detectBoundary.mockReset()
    backendMocks.smoothBoundary.mockReset()
    backendMocks.applyBoundary.mockReset()
    backendMocks.generateBase.mockReset()
    meshTrimmerMocks.autoOrientModel.mockClear()
    meshTrimmerMocks.autoOrientModel.mockReturnValue({ rotated: true, boundaryTransformMatrix: { isMatrix4: true } })
    meshTrimmerMocks.transformLoopPoints.mockClear()
    meshTrimmerMocks.transformLoopPoints.mockImplementation(loops => loops)
    mockSuccessfulBackend()
  })

  it('auto-selects the first model and auto-orients it with mesh-trimmer when opening', async () => {
    const model = makeModel()
    const three = makeThree({
      getModels: vi.fn(() => [model]),
      getSelectedObject: vi.fn(() => null),
    })
    const { wrapper } = mountBaseGenerationPanel({ three })

    await wrapper.vm.openSession()

    expect(three.selectModel).toHaveBeenCalledWith(model)
    expect(meshTrimmerMocks.autoOrientModel).toHaveBeenCalledWith(model, [[0, 0, 0], [1, 0, 0], [0, 1, 0]])
    expect(wrapper.text()).toContain('Adjust Contour')
    expect(wrapper.text()).toContain('Generate Base')
    expect(wrapper.text()).not.toContain('Processing...')
  })

  it('blocks the workflow when auto orientation fails', async () => {
    meshTrimmerMocks.autoOrientModel.mockImplementation(() => {
      throw new Error('unsupported model')
    })
    const three = makeThree()
    const { wrapper, t } = mountBaseGenerationPanel({ three })

    await wrapper.vm.openSession()

    expect(wrapper.text()).toContain(t('errors.autoOrientation.failed'))
    expect(wrapper.find('[data-test="adjust-contour"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-test="generate-base"]').attributes('disabled')).toBeDefined()
  })

  it('restores the pre-session transform when cancelling after auto orient', async () => {
    const three = makeThree()
    const originalPosition = three.model.position.clone()
    const originalRotation = three.model.rotation.clone()
    const { wrapper } = mountBaseGenerationPanel({ three })

    await wrapper.vm.openSession()
    three.model.rotation.x = 0.5
    three.model.position.z = 0

    await wrapper.vm.cancelSession()

    expect(three.model.position.toArray()).toEqual(originalPosition.toArray())
    expect(three.model.rotation.x).toBe(originalRotation.x)
  })

  it('auto-detects and smooths before direct base generation, then shows complete', async () => {
    const { wrapper } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    expect(backendMocks.detectBoundary).toHaveBeenCalled()
    expect(backendMocks.smoothBoundary).toHaveBeenCalled()
    expect(backendMocks.applyBoundary).toHaveBeenCalled()
    expect(backendMocks.generateBase).toHaveBeenCalled()
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(true)
  })

  it('locks drag controls and uses the scalpel cursor during contour adjustment', async () => {
    const three = makeThree()
    const { wrapper } = mountBaseGenerationPanel({ three })

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()

    expect(three.setDragEnabled).toHaveBeenCalledWith(false)
    expect(three.canvas.style.cursor).toContain('data:image/svg+xml')
    expect(wrapper.find('[data-test="adjust-contour"]').text()).toBe('Cancel Adjustment')

    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()

    expect(three.setDragEnabled).toHaveBeenCalledWith(true)
    expect(three.canvas.style.cursor).toBe('')
  })

  it('generates with the adjusted contour without re-smoothing over it', async () => {
    const { wrapper } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()
    const smoothCallsAfterAdjustment = backendMocks.smoothBoundary.mock.calls.length

    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    expect(backendMocks.smoothBoundary).toHaveBeenCalledTimes(smoothCallsAfterAdjustment)
    expect(backendMocks.applyBoundary).toHaveBeenCalled()
    expect(backendMocks.generateBase).toHaveBeenCalled()
  })

  it('keeps generated results when completing the session', async () => {
    const { wrapper, three } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="complete-base-generation"]').trigger('click')

    expect(wrapper.text()).not.toContain('Generate Base')
    expect(three.replaceModelGeometry).toHaveBeenCalled()
  })

  it('undoes generation and keeps the workflow available for contour edits', async () => {
    const { wrapper, three } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()
    const callsAfterGenerate = three.replaceModelGeometry.mock.calls.length

    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    expect(three.replaceModelGeometry.mock.calls.length).toBe(callsAfterGenerate)
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="adjust-contour"]').attributes('disabled')).toBeUndefined()
  })

  it('shows the PrimeVue re-adjust confirmation dialog after a base has been generated', async () => {
    const { wrapper } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()
    await wrapper.find('[data-test="adjust-contour"]').trigger('click')

    expect(wrapper.text()).toContain('Re-adjusting the contour will delete the existing base. Continue?')
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(true)
  })

  it('removes the generated base and enters contour adjustment after confirming re-adjust', async () => {
    const three = makeThree()
    const { wrapper } = mountBaseGenerationPanel({ three })

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()
    const callsAfterGenerate = three.replaceModelGeometry.mock.calls.length

    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()
    const continueButton = wrapper.findAll('button').find(button => button.text() === 'Continue')
    await continueButton.trigger('click')
    await flushPromises()

    expect(three.replaceModelGeometry.mock.calls.length).toBe(callsAfterGenerate)
    expect(wrapper.find('[data-test="complete-base-generation"]').exists()).toBe(false)
    expect(wrapper.find('[data-test="adjust-contour"]').text()).toBe('Cancel Adjustment')
    expect(three.setDragEnabled).toHaveBeenCalledWith(false)
    expect(three.canvas.style.cursor).toContain('data:image/svg+xml')
  })

  it('re-detects the current mesh boundary before regenerating after re-adjusting from an existing base', async () => {
    const firstLoop = [[0, 0, 0], [1, 0, 0], [0, 1, 0]]
    const secondLoop = [[0, 0, 1], [2, 0, 1], [0, 2, 1]]
    backendMocks.detectBoundary
      .mockResolvedValueOnce({
        success: true,
        data: {
          main_loop_index: 0,
          loop_count: 1,
          loops: [{ is_main: true, points: firstLoop, vertex_count: firstLoop.length }],
        },
      })
      .mockResolvedValueOnce({
        success: true,
        data: {
          main_loop_index: 0,
          loop_count: 1,
          loops: [{ is_main: true, points: secondLoop, vertex_count: secondLoop.length }],
        },
      })
    backendMocks.smoothBoundary
      .mockResolvedValueOnce({
        success: true,
        data: { loops: [{ points: firstLoop }] },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { loops: [{ points: secondLoop }] },
      })

    const { wrapper } = mountBaseGenerationPanel()

    await wrapper.vm.openSession()
    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="adjust-contour"]').trigger('click')
    await flushPromises()
    const continueButton = wrapper.findAll('button').find(button => button.text() === 'Continue')
    await continueButton.trigger('click')
    await flushPromises()

    await wrapper.find('[data-test="generate-base"]').trigger('click')
    await flushPromises()

    expect(backendMocks.detectBoundary).toHaveBeenCalledTimes(2)
    expect(backendMocks.smoothBoundary).toHaveBeenCalledTimes(2)
    expect(backendMocks.applyBoundary).toHaveBeenCalledTimes(2)
    expect(backendMocks.applyBoundary.mock.calls[1][1]).toEqual(secondLoop)
  })
})
