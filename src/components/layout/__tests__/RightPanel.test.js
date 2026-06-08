import enMessages from '@/i18n/locales/en.json'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'
import RightPanel from '../RightPanel.vue'

const {
  applyThreeThemeMock,
  mockAuthStore,
  mockModelStore,
  pushMock,
  saveMock,
  toggleDarkModeMock,
} = vi.hoisted(() => ({
  applyThreeThemeMock: vi.fn(),
  mockAuthStore: {
    isAuthenticated: false,
    userDisplayName: '',
  },
  mockModelStore: {
    models: [],
    selectedModel: {
      name: '',
    },
  },
  pushMock: vi.fn(),
  saveMock: vi.fn().mockResolvedValue(undefined),
  toggleDarkModeMock: vi.fn(),
}))

vi.mock('@/composables/useDarkMode', async () => {
  const { ref } = await import('vue')

  return {
    useDarkMode: () => ({
      isDark: ref(false),
      toggleDarkMode: toggleDarkModeMock,
    }),
  }
})

vi.mock('@/stores/model', () => ({
  useModelStore: () => mockModelStore,
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => mockAuthStore,
}))

vi.mock('@/utils/theme', () => ({
  applyThreeTheme: applyThreeThemeMock,
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}))

const ButtonStub = defineComponent({
  name: 'Button',
  props: {
    disabled: Boolean,
    icon: String,
    label: String,
    pt: Object,
  },
  emits: ['click'],
  setup(props, { emit, slots }) {
    return () => h(
      'button',
      {
        'type': 'button',
        'disabled': props.disabled,
        'data-icon': props.icon,
        'data-label': props.label,
        'onClick': () => emit('click'),
      },
      slots.default?.() ?? props.label,
    )
  },
})

const AvatarStub = defineComponent({
  name: 'Avatar',
  props: {
    label: String,
  },
  setup(props) {
    return () => h('div', { 'data-avatar-label': props.label })
  },
})

function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })

  return mount(RightPanel, {
    global: {
      plugins: [i18n],
      provide: {
        three: {
          projectManager: {
            save: saveMock,
          },
        },
      },
      stubs: {
        Avatar: AvatarStub,
        Button: ButtonStub,
        ModelEditor: true,
        PrinterResinSummary: true,
        PrinterSettings: true,
        SelectLocale: true,
        SlicerButton: true,
        SupportEditor: true,
        Tab: true,
        TabList: true,
        TabPanel: true,
        TabPanels: true,
        Tabs: true,
      },
    },
  })
}

function findExportButton(wrapper) {
  return wrapper.get('button[data-label="Export"]')
}

beforeEach(() => {
  mockAuthStore.isAuthenticated = false
  mockAuthStore.userDisplayName = ''
  mockModelStore.models = []
  mockModelStore.selectedModel.name = ''
  saveMock.mockClear()
  pushMock.mockClear()
  applyThreeThemeMock.mockClear()
  toggleDarkModeMock.mockClear()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('rightPanel export button', () => {
  it('calls projectManager.save when models are present', async () => {
    mockModelStore.models = [{ uuid: 'model-1' }]
    const wrapper = createWrapper()

    const exportButton = findExportButton(wrapper)
    expect(exportButton.attributes('disabled')).toBeUndefined()

    await exportButton.trigger('click')

    expect(saveMock).toHaveBeenCalledTimes(1)
  })

  it('is disabled when no models are loaded', () => {
    const wrapper = createWrapper()

    const exportButton = findExportButton(wrapper)
    expect(exportButton.attributes('disabled')).toBeDefined()
    expect(saveMock).not.toHaveBeenCalled()
  })
})
