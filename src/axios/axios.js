import { BackendError } from '@/services/errors'
import { clearStoredAuthSession, getStoredToken } from '@/utils/authSession'
import axios from 'axios'

function appendPath(baseUrl, path) {
  return `${baseUrl.replace(/\/+$/, '')}${path}`
}

const dbApiOrigin = import.meta.env.VITE_DB_API_ORIGIN
  || import.meta.env.VITE_ACCOUNT_API_ORIGIN
  || import.meta.env.VITE_AUTH_API
  || '/'

const slicerApiOrigin = import.meta.env.VITE_SLICER_API_ORIGIN
  || import.meta.env.VITE_BACKEND_URL
  || 'http://127.0.0.1:5179'

const udpApiBaseUrl = import.meta.env.VITE_UDP_API_BASE_URL
  || import.meta.env.VITE_UDP

const slicerV2ApiBaseUrl = import.meta.env.VITE_SLICER_V2_API_BASE_URL
  || appendPath(slicerApiOrigin, '/api/v2')

export const slicerV2 = axios.create({
  baseURL: slicerV2ApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000,
})

export const udp = axios.create({
  baseURL: udpApiBaseUrl,
  timeout: 120000,
})

// 請求攔截器，根據數據類型自動設置header
udp.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token)
    config.headers.Authorization = `Bearer ${token}`

  if (config.data instanceof FormData) {
    // 文件上傳，不設置Content-Type
    delete config.headers['Content-Type']
  }
  else if (config.method === 'post' || config.method === 'put') {
    // JSON數據
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

// DB-backed API: auth endpoints are rooted at /v1.
export const db = axios.create({
  baseURL: dbApiOrigin,
})

// Slicer backend origin. Requests append /api/v2, /api/jobs, or other backend paths.
export const slicer = axios.create({
  baseURL: slicerApiOrigin,
  timeout: 300000,
})

// Backward-compatible aliases for existing imports.
export const api = slicerV2
export const dbApi = db
export const accountApi = db
export const apiAuth = db
export const slicerApi = slicer
export const backendApi = slicer

const AUTH_ERROR_CODES = new Set([
  'TOKEN_MISSING',
  'TOKEN_INVALID',
  'TOKEN_INVALID_OR_EXPIRED',
])

async function getRouter() {
  const module = await import('@/router')
  return module.default
}

export async function redirectToLogin() {
  const router = await getRouter()
  const currentRoute = router.currentRoute.value
  const isAuthRoute = currentRoute.path.startsWith('/user/login')
    || currentRoute.path.startsWith('/user/register')
    || currentRoute.path.startsWith('/user/forgot-password')
    || currentRoute.path.startsWith('/user/oauth/callback')

  if (isAuthRoute)
    return

  await router.replace({
    path: '/user/login',
    query: currentRoute.fullPath && currentRoute.fullPath !== '/'
      ? { redirect: currentRoute.fullPath }
      : undefined,
  })
}

export async function handleUnauthorizedAuthError() {
  clearStoredAuthSession()
  await redirectToLogin()
}

// Reactive health recovery: when a Backend 1 (slicer) request fails at the
// connection layer, notify the backend store so it can re-probe /api/health
// and surface ServerStatusDialog. Lazy-imports the store to avoid the import
// cycle: store → backendService → axios.
//
// "Upstream failure" covers any 5xx whose body has no structured backend
// `code` — this is how Vite dev proxy surfaces ECONNREFUSED (HTTP 500 + empty
// body) and how production gateways surface upstream-down (typically 502/503/
// 504). A real backend 5xx with `{ success: false, code: '...' }` means the
// backend is alive and is excluded.
export async function maybeNotifySlicerDown(error) {
  // The health probe itself owns serverStatus; recovering from its own failure
  // would recurse (the dynamic import below defers the `checking` read past the
  // original checkHealth's finally block, so the guard there can't see it).
  const url = error?.config?.url || ''
  if (url.endsWith('/api/health'))
    return

  const status = error?.response?.status
  const code = error?.code
  const data = error?.response?.data
  const isNetwork = !error?.response
  const isTimeout = code === 'ECONNABORTED' || code === 'ETIMEDOUT' || code === 'ERR_NETWORK'
  const hasBackendCode
    = data
      && typeof data === 'object'
      && !(data instanceof Blob)
      && typeof data.code === 'string'
  const isUpstreamFailure = status >= 500 && status < 600 && !hasBackendCode

  if (!isNetwork && !isTimeout && !isUpstreamFailure)
    return

  const { useBackendStore } = await import('@/stores/useBackendStore')
  const store = useBackendStore()
  if (store.serverStatus.checking)
    return
  // Fire-and-forget: checkHealth updates serverStatus and toggles the dialog.
  store.checkHealth()
}

// Request interceptor for slicer API
slicer.interceptors.request.use((config) => {
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type']
  }
  else if (config.method === 'post' || config.method === 'put') {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

// Response interceptor: preserve slicer error codes for UI-boundary i18n mapping.
slicer.interceptors.response.use(
  (response) => {
    if (response.config.responseType !== 'blob') {
      const data = response.data
      if (data && typeof data === 'object' && data.success === false) {
        throw new BackendError(undefined, data.code, data.data)
      }
    }
    return response
  },
  async (error) => {
    // Fire-and-forget; swallow any rejection from the dynamic store import so
    // it never surfaces as an unhandled rejection (checkHealth itself can't throw).
    maybeNotifySlicerDown(error).catch(() => {})

    const response = error.response
    if (!response)
      throw error

    let errorData
    if (response.config?.responseType === 'blob' && response.data instanceof Blob) {
      try {
        errorData = JSON.parse(await response.data.text())
      }
      catch {
        throw error
      }
    }
    else {
      errorData = response.data
    }

    if (errorData?.code) {
      throw new BackendError(undefined, errorData.code, errorData.data)
    }

    throw error
  },
)

udp.interceptors.response.use(
  response => response,
  async (error) => {
    const code = error?.response?.data?.code
    const status = error?.response?.status

    if (status === 401 || AUTH_ERROR_CODES.has(code)) {
      await handleUnauthorizedAuthError()
    }

    throw error
  },
)

db.interceptors.request.use((config) => {
  const token = getStoredToken()

  if (token)
    config.headers.Authorization = `Bearer ${token}`

  return config
})

db.interceptors.response.use(
  async (response) => {
    if (AUTH_ERROR_CODES.has(response?.data?.code)) {
      await handleUnauthorizedAuthError()
      throw new BackendError(undefined, response.data.code, response.data.data)
    }

    return response
  },
  async (error) => {
    const code = error?.response?.data?.code
    const status = error?.response?.status

    if (status === 401 || AUTH_ERROR_CODES.has(code)) {
      await handleUnauthorizedAuthError()
    }

    throw error
  },
)
