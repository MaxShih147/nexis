import UserSidebarShell from '@/components/layout/UserSidebarShell.vue'
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

const authState = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('@/composables/useDarkMode', () => ({
  useDarkMode: () => ({
    isDark: false,
    toggleDarkMode: vi.fn(),
  }),
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: key => key,
  }),
}))

const ButtonStub = {
  props: ['ariaLabel', 'icon'],
  emits: ['click'],
  template: `
    <button :aria-label="ariaLabel" :data-icon="icon" @click="$emit('click', $event)">
      <slot />
    </button>
  `,
}

async function mountShell(initialPath = '/user/dashboard') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/user/dashboard', component: { template: '<div />' } },
      { path: '/user/account', component: { template: '<div />' } },
      { path: '/', component: { template: '<div />' } },
    ],
  })

  await router.push(initialPath)
  await router.isReady()

  const wrapper = mount(UserSidebarShell, {
    global: {
      plugins: [router],
      stubs: {
        Button: ButtonStub,
      },
    },
  })

  return { wrapper, router }
}

describe('userSidebarShell', () => {
  it('links to the account page with tabler user icon', async () => {
    const { wrapper } = await mountShell('/user/dashboard')
    const accountLink = wrapper.get('a[aria-label="features.auth.userNav.account"]')

    expect(accountLink.attributes('href')).toBe('/user/account')
    expect(accountLink.classes()).not.toContain('bg-zinc-900')
    expect(accountLink.find('.icon-\\[tabler--user\\]').exists()).toBe(true)
  })

  it('applies nav active styles on the account link when on /user/account', async () => {
    const { wrapper } = await mountShell('/user/account')
    const accountLink = wrapper.get('a[aria-label="features.auth.userNav.account"]')

    expect(accountLink.classes()).toContain('bg-zinc-900')
  })
})
