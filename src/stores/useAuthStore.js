import {
  completeOAuthCallback,
  getOAuthAuthorizeUrl,
  issueDeviceToken,
  loginUser,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  syncDeviceToken,
} from '@/axios/userService'
import router from '@/router'
import {
  AUTH_SESSION_EVENT,
  clearStoredAuthSession,
  clearStoredOAuthContext,
  getStoredAuthSession,
  getStoredOAuthContext,
  isTokenExpired,
  saveStoredAuthSession,
  saveStoredOAuthContext,
} from '@/utils/authSession'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

export class UdpSyncError extends Error {
  constructor(deviceToken) {
    super('UDP server unavailable')
    this.name = 'UdpSyncError'
    this.deviceToken = deviceToken
  }
}

function normalizeSession(payload = {}) {
  const accessToken = payload.access_token || payload.accessToken || ''
  const tokenType = payload.token_type || payload.tokenType || 'Bearer'
  const expiresAt = payload.expires_at || payload.expiresAt || ''
  const firstName = payload.first_name || payload.firstName || ''
  const lastName = payload.last_name || payload.lastName || ''
  const email = payload.email || ''

  const normalizedSession = {
    accessToken,
    tokenType,
    expiresAt,
    firstName,
    lastName,
    email,
  }

  return normalizedSession
}

function getInitialCharacter(value) {
  const normalizedValue = value.trim()

  if (!normalizedValue)
    return ''

  const [initial = ''] = Array.from(normalizedValue)
  const upper = initial.toLocaleUpperCase()
  const lower = initial.toLocaleLowerCase()

  return upper !== lower ? upper : initial
}

export const useAuthStore = defineStore('auth', () => {
  const accessToken = shallowRef('')
  const tokenType = shallowRef('Bearer')
  const expiresAt = shallowRef('')
  const firstName = shallowRef('')
  const lastName = shallowRef('')
  const email = shallowRef('')
  const initialized = shallowRef(false)

  const isAuthenticated = computed(() => {
    return Boolean(accessToken.value) && !isTokenExpired(expiresAt.value)
  })

  const userDisplayName = computed(() => {
    if (!accessToken.value)
      return ''

    return firstName.value
  })

  const userAvatarLabel = computed(() => {
    if (!isAuthenticated.value)
      return 'U'

    const labelFromLastName = getInitialCharacter(lastName.value)

    if (labelFromLastName)
      return labelFromLastName

    return getInitialCharacter(userDisplayName.value) || '?'
  })

  function syncFromStorage() {
    const session = getStoredAuthSession()

    if (!session || isTokenExpired(session.expiresAt)) {
      accessToken.value = ''
      tokenType.value = 'Bearer'
      expiresAt.value = ''
      firstName.value = ''
      lastName.value = ''
      email.value = ''

      if (session)
        clearStoredAuthSession()

      return
    }

    accessToken.value = session.accessToken || ''
    tokenType.value = session.tokenType || 'Bearer'
    expiresAt.value = session.expiresAt || ''
    firstName.value = session.firstName || ''
    lastName.value = session.lastName || ''
    email.value = session.email || ''
  }

  function setSession(payload) {
    const session = normalizeSession(payload)

    accessToken.value = session.accessToken
    tokenType.value = session.tokenType
    expiresAt.value = session.expiresAt
    firstName.value = session.firstName
    lastName.value = session.lastName
    email.value = session.email
    saveStoredAuthSession(session)
  }

  function clearSession() {
    accessToken.value = ''
    tokenType.value = 'Bearer'
    expiresAt.value = ''
    firstName.value = ''
    lastName.value = ''
    email.value = ''
    clearStoredAuthSession()
  }

  async function finalizeAuthenticatedSession(response, redirectTo) {
    setSession(response)

    let deviceToken
    try {
      const issued = await issueDeviceToken()
      deviceToken = issued.device_token
    }
    catch (error) {
      clearSession()
      throw error
    }

    try {
      await syncDeviceToken(deviceToken)
    }
    catch (error) {
      if (!error.response) {
        throw new UdpSyncError(deviceToken)
      }
      clearSession()
      throw error
    }

    await router.replace(redirectTo || '/user/dashboard')
    return response
  }

  async function retrySyncAndNavigate(deviceToken, redirectTo) {
    await syncDeviceToken(deviceToken)
    await router.replace(redirectTo || '/user/dashboard')
  }

  async function login(credentials, redirectTo = '/user/dashboard') {
    const response = await loginUser(credentials)
    return finalizeAuthenticatedSession({
      ...response,
      email: response.email || credentials?.email || '',
    }, redirectTo)
  }

  async function register(payload) {
    return registerUser(payload)
  }

  async function resendVerification(email) {
    return resendVerificationEmail(email)
  }

  async function forgotPassword(email) {
    return requestPasswordReset(email)
  }

  async function beginOAuth(provider, redirectUrl) {
    const response = await getOAuthAuthorizeUrl(provider, redirectUrl)

    saveStoredOAuthContext({
      provider,
      redirectUrl,
      clientState: response.client_state || response.clientState || '',
    })

    return response
  }

  async function finishOAuthCallback(code, redirectTo = '/user/dashboard') {
    const context = getStoredOAuthContext()

    const response = await completeOAuthCallback({
      code,
      redirect_url: context?.redirectUrl,
      client_state: context?.clientState,
    })

    clearStoredOAuthContext()
    return finalizeAuthenticatedSession(response, redirectTo)
  }

  async function logout({ redirectTo = '/user/login', replace = true } = {}) {
    clearStoredAuthSession()
    clearStoredOAuthContext()
    syncFromStorage()

    if (router.currentRoute.value.path === redirectTo)
      return

    if (replace)
      await router.replace(redirectTo)
    else
      await router.push(redirectTo)
  }

  function initialize() {
    if (initialized.value)
      return

    initialized.value = true
    syncFromStorage()
    window.addEventListener(AUTH_SESSION_EVENT, syncFromStorage)
  }

  return {
    accessToken,
    tokenType,
    expiresAt,
    firstName,
    lastName,
    email,
    initialized,
    isAuthenticated,
    userDisplayName,
    userAvatarLabel,
    beginOAuth,
    finishOAuthCallback,
    forgotPassword,
    initialize,
    login,
    logout,
    register,
    resendVerification,
    retrySyncAndNavigate,
    setSession,
    syncFromStorage,
  }
})
