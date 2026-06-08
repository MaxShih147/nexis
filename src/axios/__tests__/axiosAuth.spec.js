import { beforeEach, describe, expect, it, vi } from 'vitest'

const routerReplace = vi.fn()

vi.mock('@/router', () => ({
  default: {
    replace: routerReplace,
    currentRoute: {
      value: {
        fullPath: '/user/print-records',
        path: '/user/print-records',
      },
    },
  },
}))

describe('auth axios helpers', () => {
  beforeEach(() => {
    routerReplace.mockReset()
    localStorage.clear()
    localStorage.setItem('ds-online.auth.session', JSON.stringify({
      accessToken: 'token-123',
      tokenType: 'Bearer',
      expiresAt: '2099-01-01T00:00:00.000Z',
    }))
  })

  it('clears the session and redirects on unauthorized responses', async () => {
    const { handleUnauthorizedAuthError } = await import('@/axios/axios')

    await handleUnauthorizedAuthError()

    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).toHaveBeenCalledWith({
      path: '/user/login',
      query: {
        redirect: '/user/print-records',
      },
    })
  })

  it('attaches a Bearer Authorization header to db requests when a session is present', async () => {
    const { db } = await import('@/axios/axios')
    const config = await db.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: 'get',
      url: '/v1/user/presets',
    })
    expect(config.headers.Authorization).toBe('Bearer token-123')
  })

  it('attaches a Bearer Authorization header to udp requests when a session is present', async () => {
    const { udp } = await import('@/axios/axios')
    const config = await udp.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: 'post',
      url: '/api/v1/auth/device-token',
      data: {},
    })

    expect(config.headers.Authorization).toBe('Bearer token-123')
    expect(config.headers['Content-Type']).toBe('application/json')
  })

  it('omits the Authorization header when no session is stored', async () => {
    localStorage.removeItem('ds-online.auth.session')
    const { db } = await import('@/axios/axios')
    const config = await db.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: 'get',
      url: '/v1/user/presets',
    })
    expect(config.headers.Authorization).toBeUndefined()
  })

  it('omits the Authorization header from udp requests when no session is stored', async () => {
    localStorage.removeItem('ds-online.auth.session')
    const { udp } = await import('@/axios/axios')
    const config = await udp.interceptors.request.handlers[0].fulfilled({
      headers: {},
      method: 'post',
      url: '/api/v1/auth/device-token',
      data: {},
    })

    expect(config.headers.Authorization).toBeUndefined()
  })

  it('clears session and redirects when udp response returns TOKEN_MISSING in error', async () => {
    const { udp } = await import('@/axios/axios')
    const responseHandler = udp.interceptors.response.handlers[0]

    const axiosError = {
      response: {
        status: 401,
        data: { success: false, code: 'TOKEN_MISSING' },
        config: {},
      },
    }

    await expect(responseHandler.rejected(axiosError)).rejects.toBe(axiosError)

    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).toHaveBeenCalledWith({
      path: '/user/login',
      query: { redirect: '/user/print-records' },
    })
  })

  it('clears session and redirects when udp response returns TOKEN_INVALID in error', async () => {
    const { udp } = await import('@/axios/axios')
    const responseHandler = udp.interceptors.response.handlers[0]

    const axiosError = {
      response: {
        status: 401,
        data: { success: false, code: 'TOKEN_INVALID' },
        config: {},
      },
    }

    await expect(responseHandler.rejected(axiosError)).rejects.toBe(axiosError)

    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).toHaveBeenCalled()
  })

  it('clears session and redirects on raw HTTP 401 with no error code in body', async () => {
    const { udp } = await import('@/axios/axios')
    const responseHandler = udp.interceptors.response.handlers[0]

    const axiosError = {
      response: { status: 401, data: {}, config: {} },
    }

    await expect(responseHandler.rejected(axiosError)).rejects.toBe(axiosError)

    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).toHaveBeenCalled()
  })

  it('does NOT redirect for non-auth udp errors', async () => {
    const { udp } = await import('@/axios/axios')
    const responseHandler = udp.interceptors.response.handlers[0]

    const axiosError = {
      response: {
        status: 500,
        data: { success: false, code: 'PRINT_START_FAILED' },
        config: {},
      },
    }

    await expect(responseHandler.rejected(axiosError)).rejects.toBe(axiosError)

    expect(routerReplace).not.toHaveBeenCalled()
    expect(localStorage.getItem('ds-online.auth.session')).not.toBeNull()
  })

  it('does NOT redirect when already on login page and udp returns TOKEN_MISSING', async () => {
    const router = await import('@/router')
    router.default.currentRoute.value.path = '/user/login'
    router.default.currentRoute.value.fullPath = '/user/login'

    const { udp } = await import('@/axios/axios')
    const responseHandler = udp.interceptors.response.handlers[0]

    const axiosError = {
      response: {
        status: 401,
        data: { success: false, code: 'TOKEN_MISSING' },
        config: {},
      },
    }

    await expect(responseHandler.rejected(axiosError)).rejects.toBe(axiosError)

    expect(localStorage.getItem('ds-online.auth.session')).toBeNull()
    expect(routerReplace).not.toHaveBeenCalled()
  })
})
