import enMessages from '@/i18n/locales/en.json'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import LeftPanel from '../LeftPanel.vue'

const {
  mockModelStore,
  newProjectMock,
  openMock,
  saveMock,
  setProjectNameMock,
  subscribeToProjectNameMock,
} = vi.hoisted(() => ({
  mockModelStore: {
    models: [],
  },
  newProjectMock: vi.fn(),
  openMock: vi.fn(),
  saveMock: vi.fn(),
  setProjectNameMock: vi.fn(),
  subscribeToProjectNameMock: vi.fn(() => vi.fn()),
}))

vi.mock('@/stores/model', () => ({
  useModelStore: () => mockModelStore,
}))

const ButtonStub = defineComponent({
  name: 'Button',
  emits: ['click'],
  setup(_props, { emit }) {
    return () => h('button', {
      type: 'button',
      onClick: () => emit('click'),
    })
  },
})

function createWrapper(projectName = 'untitled') {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })

  return mount(LeftPanel, {
    global: {
      plugins: [i18n],
      provide: {
        three: {
          projectManager: {
            newProject: newProjectMock,
            open: openMock,
            save: saveMock,
            projectName,
            setProjectName: setProjectNameMock,
            subscribeToProjectName: subscribeToProjectNameMock,
          },
        },
      },
      stubs: {
        Button: ButtonStub,
        Menu: true,
        ModelList: true,
        RouterLink: true,
        SettingsDialog: true,
        SupportContactDialog: true,
        UploadBtn: true,
      },
      directives: {
        ripple: {},
      },
    },
  })
}

beforeEach(() => {
  mockModelStore.models = []
  newProjectMock.mockClear()
  openMock.mockClear()
  saveMock.mockClear()
  setProjectNameMock.mockClear()
  subscribeToProjectNameMock.mockClear()
  subscribeToProjectNameMock.mockImplementation(() => vi.fn())
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('leftPanel project name editing', () => {
  it('shows the current project name instead of the fixed ware label', async () => {
    const wrapper = createWrapper('Case Alpha')
    await nextTick()

    expect(wrapper.get('[data-testid="project-name-display"]').text()).toBe('Case Alpha')
  })

  it('enters edit mode on double click and saves on Enter', async () => {
    const wrapper = createWrapper('Case Alpha')

    await wrapper.get('[data-testid="project-name-display"]').trigger('dblclick')

    const input = wrapper.get('[data-testid="project-name-input"]')
    await input.setValue('Case Beta')
    await input.trigger('keydown.enter')

    expect(setProjectNameMock).toHaveBeenCalledWith('Case Beta')
  })

  it('cancels editing on Escape', async () => {
    const wrapper = createWrapper('Case Alpha')

    await wrapper.get('[data-testid="project-name-display"]').trigger('dblclick')

    const input = wrapper.get('[data-testid="project-name-input"]')
    await input.setValue('Case Beta')
    await input.trigger('keydown.esc')

    expect(setProjectNameMock).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="project-name-display"]').text()).toBe('Case Alpha')
  })

  it('saves the draft name on blur', async () => {
    const wrapper = createWrapper('Case Alpha')

    await wrapper.get('[data-testid="project-name-display"]').trigger('dblclick')

    const input = wrapper.get('[data-testid="project-name-input"]')
    await input.setValue('Case Gamma')
    await input.trigger('blur')

    expect(setProjectNameMock).toHaveBeenCalledWith('Case Gamma')
  })
})
