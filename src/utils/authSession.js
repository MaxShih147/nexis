export const AUTH_STORAGE_KEY = 'ds-online.auth.session'
export const OAUTH_STORAGE_KEY = 'ds-online.auth.oauth'
export const AUTH_SESSION_EVENT = 'ds-online:auth-session-changed'

function emitAuthSessionChanged() {
  if (typeof window === 'undefined')
    return

  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EVENT))
}

function safeParse(rawValue) {
  if (!rawValue)
    return null

  try {
    return JSON.parse(rawValue)
  }
  catch {
    return null
  }
}

export function getStoredAuthSession() {
  if (typeof window === 'undefined')
    return null

  const session = safeParse(window.localStorage.getItem(AUTH_STORAGE_KEY))

  return session
}

export function saveStoredAuthSession(session) {
  if (typeof window === 'undefined')
    return

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
  emitAuthSessionChanged()
}

export function clearStoredAuthSession() {
  if (typeof window === 'undefined')
    return

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
  emitAuthSessionChanged()
}

export function getStoredToken() {
  const session = getStoredAuthSession()
  return session?.accessToken || ''
}

export function getStoredOAuthContext() {
  if (typeof window === 'undefined')
    return null

  return safeParse(window.sessionStorage.getItem(OAUTH_STORAGE_KEY))
}

export function saveStoredOAuthContext(payload) {
  if (typeof window === 'undefined')
    return

  window.sessionStorage.setItem(OAUTH_STORAGE_KEY, JSON.stringify(payload))
}

export function clearStoredOAuthContext() {
  if (typeof window === 'undefined')
    return

  window.sessionStorage.removeItem(OAUTH_STORAGE_KEY)
}

export function isTokenExpired(expiresAt) {
  if (!expiresAt)
    return true

  const expiresAtMs = new Date(expiresAt).getTime()

  if (Number.isNaN(expiresAtMs))
    return true

  return expiresAtMs <= Date.now()
}
