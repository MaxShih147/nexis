import i18n from '@/i18n'
import EmailVerificationView from '@/views/user/EmailVerificationView.vue'
import ForgotPasswordView from '@/views/user/ForgotPasswordView.vue'
import LoginView from '@/views/user/LoginView.vue'
import OAuthCallbackView from '@/views/user/OAuthCallbackView.vue'
import RegisterView from '@/views/user/RegisterView.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerMocks = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
}))

const toastError = vi.fn()
const toastSuccess = vi.fn()
const toastInfo = vi.fn()
const routeQuery = {}

const mockLoginUser = vi.hoisted(() => vi.fn())
const mockRegisterUser = vi.hoisted(() => vi.fn())
const mockResendVerificationEmail = vi.hoisted(() => vi.fn())
const mockRequestPasswordReset = vi.hoisted(() => vi.fn())
const mockGetOAuthAuthorizeUrl = vi.hoisted(() => vi.fn())
const mockCompleteOAuthCallback = vi.hoisted(() => vi.fn())
const mockIssueDeviceToken = vi.hoisted(() => vi.fn())
const mockSyncDeviceToken = vi.hoisted(() => vi.fn())
const mockEnsureUdpServer = vi.hoisted(() => vi.fn())

vi.mock('@/router', () => ({
  default: {
    push: routerMocks.push,
    replace: routerMocks.replace,
    currentRoute: {
      value: {
        fullPath: '/user/login',
        path: '/user/login',
      },
    },
  },
}))

vi.mock('vue-router', async () => {
  const actual = await vi.importActual('vue-router')

  return {
    ...actual,
    useRouter: () => ({
      push: routerMocks.push,
      replace: routerMocks.replace,
    }),
    useRoute: () => ({
      query: routeQuery,
    }),
  }
})

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
    info: toastInfo,
  }),
}))

vi.mock('@/axios/userService', () => ({
  loginUser: mockLoginUser,
  issueDeviceToken: mockIssueDeviceToken,
  syncDeviceToken: mockSyncDeviceToken,
  registerUser: mockRegisterUser,
  resendVerificationEmail: mockResendVerificationEmail,
  requestPasswordReset: mockRequestPasswordReset,
  getOAuthAuthorizeUrl: mockGetOAuthAuthorizeUrl,
  completeOAuthCallback: mockCompleteOAuthCallback,
}))

vi.mock('@/composables/useUdpServer', () => ({
  useUdpServer: () => ({
    ensureUdpServer: mockEnsureUdpServer,
  }),
}))

const InputTextStub = {
  props: ['modelValue'],
  emits: ['update:modelValue'],
  template: `<input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)">`,
}

const PasswordStub = {
  props: ['modelValue', 'inputId', 'inputProps'],
  emits: ['update:modelValue'],
  template: `<input :id="inputId" type="password" v-bind="inputProps" :value="modelValue" @input="$emit('update:modelValue', $event.target.value)">`,
}

const ButtonStub = {
  props: ['label', 'type'],
  emits: ['click'],
  template: `<button :type="type || 'button'" @click="$emit('click', $event)"><slot>{{ label }}</slot></button>`,
}

async function mountWithRouter(component) {
  const pinia = createPinia()
  setActivePinia(pinia)

  return mount(component, {
    global: {
      plugins: [pinia, i18n],
      stubs: {
        InputText: InputTextStub,
        Password: PasswordStub,
        Button: ButtonStub,
        FloatLabel: {
          template: '<div><slot /></div>',
        },
        AuthShell: {
          template: '<div><slot /></div>',
        },
        ProgressSpinner: {
          template: '<div />',
        },
      },
    },
  })
}

describe('auth views', () => {
  beforeEach(() => {
    toastError.mockReset()
    toastSuccess.mockReset()
    toastInfo.mockReset()
    routerMocks.push.mockReset()
    routerMocks.replace.mockReset()
    mockLoginUser.mockReset()
    mockRegisterUser.mockReset()
    mockRequestPasswordReset.mockReset()
    mockGetOAuthAuthorizeUrl.mockReset()
    mockCompleteOAuthCallback.mockReset()
    mockIssueDeviceToken.mockReset()
    mockSyncDeviceToken.mockReset()
    mockResendVerificationEmail.mockReset()
    mockEnsureUdpServer.mockReset()
    localStorage.clear()
    sessionStorage.clear()
    Object.keys(routeQuery).forEach(key => delete routeQuery[key])
  })

  it('blocks invalid login form submission and shows a toast', async () => {
    const wrapper = await mountWithRouter(LoginView)

    await wrapper.find('form').trigger('submit.prevent')

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(wrapper.text()).toContain('Enter your email.')
  })

  it('blocks weak register password before calling the backend', async () => {
    const wrapper = await mountWithRouter(RegisterView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Ada')
    await inputs[1].setValue('Lovelace')
    await inputs[2].setValue('ada@example.com')
    await inputs[3].setValue('weak')
    await wrapper.find('form').trigger('submit.prevent')

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Password does not meet the security rules.')
  })

  it('validates register name fields while typing', async () => {
    const wrapper = await mountWithRouter(RegisterView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Ada!')

    expect(wrapper.text()).toContain('Use letters only.')
  })

  it('keeps auth labels theme-aware for light and dark mode', async () => {
    const wrapper = await mountWithRouter(RegisterView)
    const emailLabel = wrapper.find('label[for="register-email"]')

    expect(emailLabel.attributes('class')).toContain('text-zinc-500')
    expect(emailLabel.attributes('class')).toContain('dark:text-[rgba(250,250,250,0.72)]')
  })

  it('displays CREDENTIALS_INVALID error on email and password fields', async () => {
    mockLoginUser.mockRejectedValue({ response: { data: { code: 'CREDENTIALS_INVALID' } } })
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('ada@example.com')
    await inputs[1].setValue('Wrong#Pass1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Incorrect email or password.')
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('redirects to the printer dashboard after a successful login when no redirect query is present', async () => {
    mockLoginUser.mockResolvedValue({
      access_token: 'token-abc',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    mockIssueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    mockSyncDeviceToken.mockResolvedValue({})
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('ada@example.com')
    await inputs[1].setValue('Valid#Pass1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(routerMocks.replace).toHaveBeenCalledWith('/user/dashboard')
  })

  it('shows an error toast and stays on the page when backend 2 rejects the device token', async () => {
    mockLoginUser.mockResolvedValue({
      access_token: 'token-abc',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    mockIssueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    mockSyncDeviceToken.mockRejectedValue({
      response: { data: { code: 'DEVICE_TOKEN_INVALID' } },
    })
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('ada@example.com')
    await inputs[1].setValue('Valid#Pass1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(routerMocks.replace).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('shows ACCOUNT_NOT_VERIFIED error and a resend button', async () => {
    mockLoginUser.mockRejectedValue({ response: { data: { code: 'ACCOUNT_NOT_VERIFIED' } } })
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('ada@example.com')
    await inputs[1].setValue('Valid#Pass1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Please verify your account before logging in.')
    expect(wrapper.text()).toContain('Resend verification email')
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('shows a coming soon toast instead of starting OAuth', async () => {
    const wrapper = await mountWithRouter(LoginView)
    const buttons = wrapper.findAll('button')
    const googleButton = buttons.find(button => button.text().includes('Google'))

    expect(googleButton).toBeTruthy()

    await googleButton.trigger('click')

    expect(toastInfo).toHaveBeenCalledTimes(1)
    expect(toastInfo).toHaveBeenCalledWith(
      'Feature coming soon',
      'OAuth login is not available yet.',
    )
    expect(mockGetOAuthAuthorizeUrl).not.toHaveBeenCalled()
  })

  it('shows rate limit error on login', async () => {
    mockLoginUser.mockRejectedValue({ response: { data: { code: 'RATE_LIMIT_EXCEEDED' } } })
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('ada@example.com')
    await inputs[1].setValue('Valid#Pass1')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Too many attempts. Please try again later.')
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('passes current-password autocomplete to the login password input', async () => {
    const wrapper = await mountWithRouter(LoginView)
    const inputs = wrapper.findAll('input')

    expect(inputs[1].attributes('id')).toBe('login-password')
    expect(inputs[1].attributes('autocomplete')).toBe('current-password')
  })

  it('redirects to email verification page after successful registration', async () => {
    mockRegisterUser.mockResolvedValue({})
    const wrapper = await mountWithRouter(RegisterView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Ada')
    await inputs[1].setValue('Lovelace')
    await inputs[2].setValue('ada@example.com')
    await inputs[3].setValue('Valid@Password1!')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(toastSuccess).not.toHaveBeenCalled()
    expect(routerMocks.replace).toHaveBeenCalledWith({
      path: '/user/email-verification',
      query: { email: 'ada@example.com' },
    })
  })

  it('shows rate limit error on registration', async () => {
    mockRegisterUser.mockRejectedValue({ response: { data: { code: 'RATE_LIMIT_EXCEEDED' } } })
    const wrapper = await mountWithRouter(RegisterView)
    const inputs = wrapper.findAll('input')

    await inputs[0].setValue('Ada')
    await inputs[1].setValue('Lovelace')
    await inputs[2].setValue('ada@example.com')
    await inputs[3].setValue('Valid@Password1!')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Too many attempts. Please try again later.')
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('passes new-password autocomplete to the register password input', async () => {
    const wrapper = await mountWithRouter(RegisterView)
    const inputs = wrapper.findAll('input')

    expect(inputs[3].attributes('id')).toBe('register-password')
    expect(inputs[3].attributes('autocomplete')).toBe('new-password')
  })

  describe('forgotPasswordView', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('submits and shows a success toast', async () => {
      mockRequestPasswordReset.mockResolvedValue({})
      const wrapper = await mountWithRouter(ForgotPasswordView)

      await wrapper.find('input').setValue('ada@example.com')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(mockRequestPasswordReset).toHaveBeenCalledWith('ada@example.com')
      expect(toastSuccess).toHaveBeenCalledTimes(1)
    })

    it('starts a 60s cooldown after a successful reset request', async () => {
      mockRequestPasswordReset.mockResolvedValue({})
      const wrapper = await mountWithRouter(ForgotPasswordView)

      await wrapper.find('input').setValue('ada@example.com')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      const button = wrapper.find('button[type="submit"]')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Send again in 60s')

      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()
      expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(60_000)
      expect(button.attributes('disabled')).toBeUndefined()

      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()
      expect(mockRequestPasswordReset).toHaveBeenCalledTimes(2)
    })

    it('blocks submission with an empty email field', async () => {
      const wrapper = await mountWithRouter(ForgotPasswordView)

      await wrapper.find('form').trigger('submit.prevent')

      expect(toastError).toHaveBeenCalledTimes(1)
      expect(mockRequestPasswordReset).not.toHaveBeenCalled()
    })

    it('shows email invalid error on a 400 response', async () => {
      mockRequestPasswordReset.mockRejectedValue({ response: { status: 400 } })
      const wrapper = await mountWithRouter(ForgotPasswordView)

      await wrapper.find('input').setValue('ada@example.com')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(wrapper.text()).toContain('Enter a valid email.')
    })

    it('shows rate limit error on a 429 response', async () => {
      mockRequestPasswordReset.mockRejectedValue({
        response: { status: 429, data: { code: 'RATE_LIMIT_EXCEEDED' } },
      })
      const wrapper = await mountWithRouter(ForgotPasswordView)

      await wrapper.find('input').setValue('ada@example.com')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()

      expect(wrapper.text()).toContain('Too many attempts. Please try again later.')
      expect(toastError).toHaveBeenCalledTimes(1)
    })
  })

  describe('oAuthCallbackView', () => {
    it('shows an error toast when no code is present in the callback URL', async () => {
      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(toastError).toHaveBeenCalledTimes(1)
      expect(mockCompleteOAuthCallback).not.toHaveBeenCalled()
    })

    it('completes OAuth and shows success toast after a valid callback', async () => {
      routeQuery.code = 'oauth-code-123'
      mockCompleteOAuthCallback.mockResolvedValue({
        access_token: 'token-abc',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00.000Z',
      })
      mockIssueDeviceToken.mockResolvedValue({
        device_token: 'a'.repeat(64),
      })
      mockSyncDeviceToken.mockResolvedValue({})

      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(mockCompleteOAuthCallback).toHaveBeenCalled()
      expect(mockIssueDeviceToken).toHaveBeenCalled()
      expect(mockSyncDeviceToken).toHaveBeenCalledWith('a'.repeat(64))
      expect(toastSuccess).toHaveBeenCalledTimes(1)
    })

    it('shows an error toast when the OAuth state is rejected by the server', async () => {
      routeQuery.code = 'oauth-code-123'
      mockCompleteOAuthCallback.mockRejectedValue({
        response: { data: { code: 'INVALID_OAUTH_STATE' } },
      })

      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(mockCompleteOAuthCallback).toHaveBeenCalled()
      expect(toastError).toHaveBeenCalledTimes(1)
    })

    it('opens UDPServerDialog when backend 2 is unreachable during OAuth callback', async () => {
      routeQuery.code = 'oauth-code-123'
      mockCompleteOAuthCallback.mockResolvedValue({
        access_token: 'token-abc',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00.000Z',
      })
      mockIssueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
      mockSyncDeviceToken.mockRejectedValue(new Error('Network Error'))
      mockEnsureUdpServer.mockResolvedValue(false)

      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(mockEnsureUdpServer).toHaveBeenCalledTimes(1)
      expect(toastError).toHaveBeenCalledTimes(1)
    })

    it('navigates and shows success toast when ensureUdpServer resolves and OAuth retry succeeds', async () => {
      routeQuery.code = 'oauth-code-123'
      mockCompleteOAuthCallback.mockResolvedValue({
        access_token: 'token-abc',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00.000Z',
      })
      mockIssueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
      mockSyncDeviceToken
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({})
      mockEnsureUdpServer.mockResolvedValue(true)

      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(toastSuccess).toHaveBeenCalledTimes(1)
      expect(routerMocks.replace).toHaveBeenCalledWith('/user/dashboard')
      expect(localStorage.getItem('ds-online.auth.session')).not.toBeNull()
    })

    it('logs out and shows error toast when ensureUdpServer returns true but OAuth retry fails', async () => {
      routeQuery.code = 'oauth-code-123'
      mockCompleteOAuthCallback.mockResolvedValue({
        access_token: 'token-abc',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00.000Z',
      })
      mockIssueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
      mockSyncDeviceToken.mockRejectedValue(new Error('Network Error'))
      mockEnsureUdpServer.mockResolvedValue(true)

      await mountWithRouter(OAuthCallbackView)
      await flushPromises()

      expect(toastError).toHaveBeenCalledTimes(1)
      expect(routerMocks.replace).not.toHaveBeenCalledWith('/user/dashboard')
      expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    })
  })

  describe('loginView UDP server dialog', () => {
    function setupSuccessfulLogin() {
      mockLoginUser.mockResolvedValue({
        access_token: 'token-abc',
        token_type: 'Bearer',
        expires_at: '2099-01-01T00:00:00.000Z',
      })
      mockIssueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
    }

    async function submitLoginForm(wrapper) {
      const inputs = wrapper.findAll('input')
      await inputs[0].setValue('ada@example.com')
      await inputs[1].setValue('Valid#Pass1')
      await wrapper.find('form').trigger('submit.prevent')
      await flushPromises()
    }

    it('calls ensureUdpServer when backend 2 is unreachable on login', async () => {
      setupSuccessfulLogin()
      mockSyncDeviceToken.mockRejectedValue(new Error('Network Error'))
      mockEnsureUdpServer.mockResolvedValue(false)

      const wrapper = await mountWithRouter(LoginView)
      await submitLoginForm(wrapper)

      expect(mockEnsureUdpServer).toHaveBeenCalledTimes(1)
    })

    it('shows success toast and navigates when ensureUdpServer resolves and retry succeeds', async () => {
      setupSuccessfulLogin()
      mockSyncDeviceToken
        .mockRejectedValueOnce(new Error('Network Error'))
        .mockResolvedValueOnce({})
      mockEnsureUdpServer.mockResolvedValue(true)

      const wrapper = await mountWithRouter(LoginView)
      await submitLoginForm(wrapper)

      expect(toastSuccess).toHaveBeenCalledTimes(1)
      expect(routerMocks.replace).toHaveBeenCalledWith('/user/dashboard')
    })

    it('logs out and shows error toast when user cancels UDPServerDialog', async () => {
      setupSuccessfulLogin()
      mockSyncDeviceToken.mockRejectedValue(new Error('Network Error'))
      mockEnsureUdpServer.mockResolvedValue(false)

      const wrapper = await mountWithRouter(LoginView)
      await submitLoginForm(wrapper)

      expect(toastError).toHaveBeenCalledTimes(1)
      expect(routerMocks.replace).not.toHaveBeenCalledWith('/user/dashboard')
      expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    })

    it('logs out and shows error toast when ensureUdpServer returns true but retry fails', async () => {
      setupSuccessfulLogin()
      mockSyncDeviceToken.mockRejectedValue(new Error('Network Error'))
      mockEnsureUdpServer.mockResolvedValue(true)

      const wrapper = await mountWithRouter(LoginView)
      await submitLoginForm(wrapper)

      expect(toastError).toHaveBeenCalledTimes(1)
      expect(routerMocks.replace).not.toHaveBeenCalledWith('/user/dashboard')
      expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    })
  })

  describe('emailVerificationView', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('renders the title, subtitle, and resend action', async () => {
      routeQuery.email = 'ada@example.com'
      const wrapper = await mountWithRouter(EmailVerificationView)

      expect(wrapper.text()).toContain('We\'ve sent you a verification email')
      expect(wrapper.text()).toContain('Please check your inbox.')
      expect(wrapper.text()).toContain('Didn\'t get the email?')
      expect(wrapper.find('[data-testid="resend-button"]').text()).toContain('Resend')
    })

    it('calls resendVerification with the query email on first click', async () => {
      routeQuery.email = 'ada@example.com'
      mockResendVerificationEmail.mockResolvedValue({})
      const wrapper = await mountWithRouter(EmailVerificationView)

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()

      expect(mockResendVerificationEmail).toHaveBeenCalledWith('ada@example.com')
      expect(toastSuccess).toHaveBeenCalledTimes(1)
    })

    it('disables the resend button and shows remaining seconds during the 60s cooldown', async () => {
      routeQuery.email = 'ada@example.com'
      mockResendVerificationEmail.mockResolvedValue({})
      const wrapper = await mountWithRouter(EmailVerificationView)

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()

      const button = wrapper.find('[data-testid="resend-button"]')
      expect(button.attributes('disabled')).toBeDefined()
      expect(wrapper.text()).toContain('Resend available in 60s')

      await vi.advanceTimersByTimeAsync(5000)
      expect(wrapper.text()).toContain('Resend available in 55s')

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()
      expect(mockResendVerificationEmail).toHaveBeenCalledTimes(1)
    })

    it('re-enables the resend button after the cooldown completes', async () => {
      routeQuery.email = 'ada@example.com'
      mockResendVerificationEmail.mockResolvedValue({})
      const wrapper = await mountWithRouter(EmailVerificationView)

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()

      await vi.advanceTimersByTimeAsync(60_000)

      const button = wrapper.find('[data-testid="resend-button"]')
      expect(button.attributes('disabled')).toBeUndefined()
      expect(wrapper.text()).not.toContain('Resend available in')

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()
      expect(mockResendVerificationEmail).toHaveBeenCalledTimes(2)
    })

    it('shows an error toast when the resend request fails', async () => {
      routeQuery.email = 'ada@example.com'
      mockResendVerificationEmail.mockRejectedValue(new Error('network'))
      const wrapper = await mountWithRouter(EmailVerificationView)

      await wrapper.find('[data-testid="resend-button"]').trigger('click')
      await flushPromises()

      expect(toastError).toHaveBeenCalledTimes(1)
      const button = wrapper.find('[data-testid="resend-button"]')
      expect(button.attributes('disabled')).toBeUndefined()
    })
  })
})
