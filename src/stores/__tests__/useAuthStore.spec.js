import { saveStoredOAuthContext } from '@/utils/authSession'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerReplace = vi.fn()

vi.mock('@/router', () => ({
  default: {
    replace: routerReplace,
    push: vi.fn(),
    currentRoute: {
      value: {
        fullPath: '/',
        path: '/',
      },
    },
  },
}))

const loginUser = vi.fn()
const issueDeviceToken = vi.fn()
const syncDeviceToken = vi.fn()
const completeOAuthCallback = vi.fn()

vi.mock('@/axios/userService', () => ({
  loginUser,
  issueDeviceToken,
  syncDeviceToken,
  registerUser: vi.fn(),
  resendVerificationEmail: vi.fn(),
  requestPasswordReset: vi.fn(),
  getOAuthAuthorizeUrl: vi.fn(),
  completeOAuthCallback,
}))

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    routerReplace.mockReset()
    loginUser.mockReset()
    issueDeviceToken.mockReset()
    syncDeviceToken.mockReset()
    completeOAuthCallback.mockReset()
    localStorage.clear()
    sessionStorage.clear()
  })

  it('stores the token and redirects after a successful login', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    }, '/')

    expect(authStore.isAuthenticated).toBe(true)
    expect(issueDeviceToken).toHaveBeenCalledTimes(1)
    expect(syncDeviceToken).toHaveBeenCalledWith('a'.repeat(64))
    expect(routerReplace).toHaveBeenCalledWith('/')
    expect(JSON.parse(localStorage.getItem('ds-online.auth.session'))).toMatchObject({
      accessToken: 'token-123',
      tokenType: 'Bearer',
    })
  })

  it('persists profile names and derives the avatar label from last_name', async () => {
    const loginResponse = {
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
      first_name: 'Chloe',
      last_name: '陳',
    }
    loginUser.mockResolvedValue(loginResponse)
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    })

    expect(authStore.userDisplayName).toBe('Chloe')
    expect(authStore.userAvatarLabel).toBe('陳')
    expect(authStore.email).toBe('ada@example.com')
    expect(JSON.parse(localStorage.getItem('ds-online.auth.session'))).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Chloe',
      lastName: '陳',
    })
  })

  it('prefers login response email over submitted credentials when both are present', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
      email: 'portal@example.com',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.login({
      email: 'typed@example.com',
      password: 'Valid#Password1',
    })

    expect(authStore.email).toBe('portal@example.com')
  })

  it('redirects to the printer dashboard by default after a successful login', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    })

    expect(routerReplace).toHaveBeenCalledWith('/user/dashboard')
  })

  it('clears the session and does not redirect when device token sync fails after login', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockRejectedValue({
      response: { data: { code: 'DEVICE_TOKEN_INVALID' } },
    })

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await expect(authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    })).rejects.toMatchObject({
      response: { data: { code: 'DEVICE_TOKEN_INVALID' } },
    })

    expect(authStore.isAuthenticated).toBe(false)
    expect(authStore.firstName).toBe('')
    expect(authStore.lastName).toBe('')
    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('falls back to the display name initial when last_name is blank', async () => {
    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    authStore.setSession({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
      first_name: 'Ada',
      last_name: '   ',
    })

    expect(authStore.userDisplayName).toBe('Ada')
    expect(authStore.userAvatarLabel).toBe('A')
  })

  it('persists email from OAuth callback response', async () => {
    saveStoredOAuthContext({
      provider: 'google',
      redirectUrl: 'http://localhost/callback',
      clientState: 'state-1',
    })
    completeOAuthCallback.mockResolvedValue({
      access_token: 'token-oauth',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
      email: 'oauth.user@example.com',
      first_name: 'OAuth',
      last_name: 'User',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'b'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.finishOAuthCallback('auth-code', '/user/account')

    expect(authStore.email).toBe('oauth.user@example.com')
    expect(JSON.parse(localStorage.getItem('ds-online.auth.session'))).toMatchObject({
      email: 'oauth.user@example.com',
    })
    expect(routerReplace).toHaveBeenCalledWith('/user/account')
  })

  it('leaves email empty when OAuth callback response has no email', async () => {
    saveStoredOAuthContext({
      provider: 'google',
      redirectUrl: 'http://localhost/callback',
      clientState: 'state-1',
    })
    completeOAuthCallback.mockResolvedValue({
      access_token: 'token-oauth',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({
      device_token: 'b'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.finishOAuthCallback('auth-code')

    expect(authStore.email).toBe('')
  })

  it('falls back to ? when login response has no first_name and no last_name', async () => {
    const loginResponse = {
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    }
    loginUser.mockResolvedValue(loginResponse)
    issueDeviceToken.mockResolvedValue({
      device_token: 'a'.repeat(64),
    })
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    })

    expect(authStore.lastName).toBe('')
    expect(authStore.userDisplayName).toBe('')
    expect(authStore.userAvatarLabel).toBe('?')
  })

  it('throws UdpSyncError and preserves session when syncDeviceToken fails with a network error (no response)', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
    syncDeviceToken.mockRejectedValue(new Error('Network Error'))

    const { useAuthStore, UdpSyncError } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    const error = await authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    }).catch(e => e)

    expect(error).toBeInstanceOf(UdpSyncError)
    expect(error.deviceToken).toBe('a'.repeat(64))
    expect(authStore.isAuthenticated).toBe(true)
    expect(localStorage.getItem('ds-online.auth.session')).not.toBeNull()
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('clears session and rethrows original error when syncDeviceToken fails with an HTTP response error', async () => {
    loginUser.mockResolvedValue({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })
    issueDeviceToken.mockResolvedValue({ device_token: 'a'.repeat(64) })
    const httpError = { response: { data: { code: 'DEVICE_TOKEN_INVALID' } } }
    syncDeviceToken.mockRejectedValue(httpError)

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await expect(authStore.login({
      email: 'ada@example.com',
      password: 'Valid#Password1',
    })).rejects.toMatchObject({ response: { data: { code: 'DEVICE_TOKEN_INVALID' } } })

    expect(authStore.isAuthenticated).toBe(false)
    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).not.toHaveBeenCalled()
  })

  it('calls router.replace when retrySyncAndNavigate succeeds', async () => {
    syncDeviceToken.mockResolvedValue({})

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    authStore.setSession({
      access_token: 'token-123',
      token_type: 'Bearer',
      expires_at: '2099-01-01T00:00:00.000Z',
    })

    await authStore.retrySyncAndNavigate('device-token-xyz', '/user/dashboard')

    expect(syncDeviceToken).toHaveBeenCalledWith('device-token-xyz')
    expect(routerReplace).toHaveBeenCalledWith('/user/dashboard')
  })

  it('throws when retrySyncAndNavigate fails', async () => {
    syncDeviceToken.mockRejectedValue(new Error('still down'))

    const { useAuthStore } = await import('@/stores/useAuthStore')
    const authStore = useAuthStore()

    await expect(
      authStore.retrySyncAndNavigate('device-token-xyz', '/user/dashboard'),
    ).rejects.toThrow('still down')

    expect(routerReplace).not.toHaveBeenCalled()
  })
})
