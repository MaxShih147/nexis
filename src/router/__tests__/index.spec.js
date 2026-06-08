import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/views/HomeView.vue', () => ({ default: { template: '<div />' } }))
vi.mock('@/stores/state', () => ({
  useGeneralStore: () => ({ checkScene: false }),
}))

const { authNavigationGuard } = await import('@/router/index.js')

const VALID_SESSION = JSON.stringify({
  accessToken: 'token-123',
  tokenType: 'Bearer',
  expiresAt: '2099-01-01T00:00:00.000Z',
})

function makeRoute(path, meta = {}, query = {}) {
  const search = new URLSearchParams(query).toString()
  return {
    path,
    fullPath: search ? `${path}?${search}` : path,
    meta,
    query,
  }
}

describe('authNavigationGuard', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  it('redirects unauthenticated users away from requiresAuth routes and preserves the original target', () => {
    const result = authNavigationGuard(makeRoute('/user/dashboard', { requiresAuth: true }))
    expect(result).toEqual({
      path: '/user/login',
      query: { redirect: '/user/dashboard' },
    })
  })

  it('redirects unauthenticated users away from the account page', () => {
    const result = authNavigationGuard(makeRoute('/user/account', { requiresAuth: true }))
    expect(result).toEqual({
      path: '/user/login',
      query: { redirect: '/user/account' },
    })
  })

  it('preserves the full path including query when redirecting to login', () => {
    const result = authNavigationGuard(
      makeRoute('/user/print-records', { requiresAuth: true }, { page: '2' }),
    )
    expect(result.query.redirect).toBe('/user/print-records?page=2')
  })

  it('lets authenticated users into requiresAuth routes', () => {
    localStorage.setItem('ds-online.auth.session', VALID_SESSION)
    const result = authNavigationGuard(makeRoute('/user/dashboard', { requiresAuth: true }))
    expect(result).toBeUndefined()
  })

  it('redirects authenticated users away from guestOnly routes to /user/dashboard', () => {
    localStorage.setItem('ds-online.auth.session', VALID_SESSION)
    const result = authNavigationGuard(makeRoute('/user/login', { guestOnly: true }))
    expect(result).toBe('/user/dashboard')
  })

  it('lets unauthenticated users into guestOnly routes', () => {
    const result = authNavigationGuard(makeRoute('/user/login', { guestOnly: true }))
    expect(result).toBeUndefined()
  })

  it('does not interfere with public routes that have no auth meta', () => {
    const result = authNavigationGuard(makeRoute('/'))
    expect(result).toBeUndefined()
  })

  it('treats expired stored sessions as unauthenticated and redirects to login', () => {
    localStorage.setItem('ds-online.auth.session', JSON.stringify({
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
    }))
    const result = authNavigationGuard(makeRoute('/user/dashboard', { requiresAuth: true }))
    expect(result?.path).toBe('/user/login')
  })
})
