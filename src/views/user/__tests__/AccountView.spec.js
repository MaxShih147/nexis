import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AccountView from '../AccountView.vue'

const authState = vi.hoisted(() => ({
  firstName: 'Tim',
  lastName: 'Chen',
  email: 'tim@example.com',
}))

vi.mock('@/stores/useAuthStore', () => ({
  useAuthStore: () => authState,
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: key => key,
  }),
}))

const InputTextStub = {
  props: ['modelValue', 'readonly', 'id'],
  template: '<input :id="id" :value="modelValue" :readonly="readonly" />',
}

function mountAccountView() {
  return mount(AccountView, {
    global: {
      stubs: {
        InputText: InputTextStub,
      },
    },
  })
}

describe('accountView', () => {
  it('renders full name with first name before last name', () => {
    authState.firstName = 'Tim'
    authState.lastName = 'Chen'

    const wrapper = mountAccountView()

    expect(wrapper.get('#account-full-name').element.value).toBe('Tim Chen')
  })

  it('renders email from auth session as readonly', () => {
    authState.email = 'tim@example.com'

    const wrapper = mountAccountView()

    const emailInput = wrapper.get('#account-email')
    expect(emailInput.element.value).toBe('tim@example.com')
    expect(emailInput.attributes('readonly')).toBeDefined()
  })

  it('shows em dash when email is missing from session', () => {
    authState.email = ''

    const wrapper = mountAccountView()

    expect(wrapper.get('#account-email').element.value).toBe('—')
  })

  it('shows em dash when names are missing', () => {
    authState.firstName = ''
    authState.lastName = ''

    const wrapper = mountAccountView()

    expect(wrapper.get('#account-full-name').element.value).toBe('—')
  })
})
