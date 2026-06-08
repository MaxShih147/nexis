import RightPanel from '@/components/layout/RightPanel.vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  userAvatarLabel: 'U',
}))

const routerPush = vi.hoisted(() => vi.fn())
const toggleDarkMode = vi.hoisted(() => vi.fn())

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/stores/model', () => ({
  useModelStore: () => ({
    selectedModel: null,
  }),
}))

vi.mock('@/composables/useDarkMode', () => ({
  useDarkMode: () => ({
    isDark: ref(false),
    toggleDarkMode,
  }),
}))

vi.mock('@/utils/theme', () => ({
  applyThreeTheme: vi.fn(),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPush,
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: key => key,
  }),
}))

const ButtonStub = {
  props: ['ariaLabel', 'text', 'rounded', 'severity', 'icon', 'label'],
  emits: ['click'],
  template: `
    <button
      :aria-label="ariaLabel"
      :data-icon="icon"
      :data-label="label"
      @click="$emit('click', $event)"
    >
      <slot>{{ label }}</slot>
    </button>
  `,
}

const AvatarStub = {
  props: ['label'],
  template: '<div data-testid="avatar-label">{{ label }}</div>',
}

function mountRightPanel() {
  return mount(RightPanel, {
    global: {
      provide: {
        three: null,
      },
      stubs: {
        Button: ButtonStub,
        Avatar: AvatarStub,
        SelectLocale: { template: '<div />' },
        PrinterSettings: { template: '<div />' },
        PrinterResinSummary: { template: '<div />' },
        SlicerButton: { template: '<div />' },
        Tabs: { template: '<div><slot /></div>' },
        TabList: { template: '<div><slot /></div>' },
        Tab: { template: '<div><slot /></div>' },
        TabPanels: { template: '<div><slot /></div>' },
        TabPanel: { template: '<div><slot /></div>' },
        ModelEditor: { template: '<div />' },
        SupportEditor: { template: '<div />' },
      },
    },
  })
}

describe('rightPanel', () => {
  it('logs the right panel header avatar label ref value', () => {
    authState.isAuthenticated = true
    authState.userAvatarLabel = '陳'

    const wrapper = mountRightPanel()
    const avatarRef = wrapper.vm.userAvatarRef?.label
      ? wrapper.vm.userAvatarRef
      : wrapper.vm.userAvatarRef?.value
    const renderedAvatarLabel = wrapper.get('[data-testid="avatar-label"]').text()

    expect(avatarRef?.label).toBe('陳')
    expect(renderedAvatarLabel).toBe('陳')
  })

  it.each([
    ['traditional Chinese', '陳', '陳'],
    ['simplified Chinese', '陈', '陈'],
    ['English', 'C', 'C'],
    ['Japanese', '山', '山'],
  ])('renders %s avatar labels without mojibake', (labelName, avatarLabel, expected) => {
    authState.userAvatarLabel = avatarLabel

    const wrapper = mountRightPanel()

    expect(wrapper.get('[data-testid="avatar-label"]').text(), labelName).toBe(expected)
  })

  it('routes authenticated users to the account page when clicking the avatar button', async () => {
    authState.isAuthenticated = true
    authState.userAvatarLabel = '陳'
    routerPush.mockReset()

    const wrapper = mountRightPanel()
    await wrapper.get('button[aria-label="features.auth.userNav.account"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/user/account')
  })

  it('routes unauthenticated users to login when clicking the avatar button', async () => {
    authState.isAuthenticated = false
    routerPush.mockReset()

    const wrapper = mountRightPanel()
    await wrapper.get('button[aria-label="features.auth.loginTitle"]').trigger('click')

    expect(routerPush).toHaveBeenCalledWith('/user/login')
  })
})
