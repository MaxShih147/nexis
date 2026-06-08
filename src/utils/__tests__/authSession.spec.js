import {
  AUTH_SESSION_EVENT,
  AUTH_STORAGE_KEY,
  clearStoredAuthSession,
  clearStoredOAuthContext,
  getStoredAuthSession,
  getStoredOAuthContext,
  getStoredToken,
  isTokenExpired,
  OAUTH_STORAGE_KEY,
  saveStoredAuthSession,
  saveStoredOAuthContext,
} from '@/utils/authSession'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('authSession storage helpers', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('round-trips an auth session and emits a change event on save and clear', () => {
    const session = { accessToken: 'token-1', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00.000Z' }
    const handler = vi.fn()
    window.addEventListener(AUTH_SESSION_EVENT, handler)

    saveStoredAuthSession(session)
    expect(JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY))).toEqual(session)
    expect(getStoredAuthSession()).toEqual(session)
    expect(getStoredToken()).toBe('token-1')

    clearStoredAuthSession()
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull()
    expect(getStoredAuthSession()).toBeNull()
    expect(getStoredToken()).toBe('')
    expect(handler).toHaveBeenCalledTimes(2)

    window.removeEventListener(AUTH_SESSION_EVENT, handler)
  })

  it('returns null when stored auth session JSON is corrupt', () => {
    localStorage.setItem(AUTH_STORAGE_KEY, '{not json')
    expect(getStoredAuthSession()).toBeNull()
  })

  it('round-trips OAuth context via sessionStorage without emitting auth-session event', () => {
    const handler = vi.fn()
    window.addEventListener(AUTH_SESSION_EVENT, handler)

    const ctx = { provider: 'google', redirectUrl: 'https://x/cb', clientState: 'abc' }
    saveStoredOAuthContext(ctx)
    expect(JSON.parse(sessionStorage.getItem(OAUTH_STORAGE_KEY))).toEqual(ctx)
    expect(getStoredOAuthContext()).toEqual(ctx)

    clearStoredOAuthContext()
    expect(sessionStorage.getItem(OAUTH_STORAGE_KEY)).toBeNull()
    expect(handler).not.toHaveBeenCalled()

    window.removeEventListener(AUTH_SESSION_EVENT, handler)
  })
})

describe('isTokenExpired', () => {
  it('treats missing or invalid timestamps as expired', () => {
    expect(isTokenExpired('')).toBe(true)
    expect(isTokenExpired(null)).toBe(true)
    expect(isTokenExpired('not-a-date')).toBe(true)
  })

  it('returns true at or after the expiry instant and false strictly before', () => {
    const past = new Date(Date.now() - 1000).toISOString()
    const future = new Date(Date.now() + 60_000).toISOString()
    expect(isTokenExpired(past)).toBe(true)
    expect(isTokenExpired(future)).toBe(false)
  })
})
