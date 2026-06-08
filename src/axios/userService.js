import { db, udp } from '@/axios/axios'

function unwrapResponse(response) {
  return response?.data?.data ?? response?.data ?? {}
}

function unwrapEnvelope(response) {
  return response?.data ?? {}
}

function resolveUdpApiPath(path) {
  const baseUrl = udp?.defaults?.baseURL

  if (!baseUrl)
    return path

  try {
    return new URL(path, baseUrl).toString()
  }
  catch {
    return path
  }
}

export async function getAccountHealth() {
  const response = await db.get('/health')
  return unwrapEnvelope(response)
}

export async function loginUser({ email, password }) {
  const response = await db.post('/v1/auth/login', {
    email,
    password,
  })
  const payload = unwrapResponse(response)

  return payload
}

export async function registerUser({ email, password, firstName, lastName }) {
  const response = await db.post('/v1/auth/register', {
    email,
    password,
    firstName,
    lastName,
  })
  return unwrapResponse(response)
}

export async function resendVerificationEmail(email) {
  const response = await db.post('/v1/auth/resend-verification', { email })
  return unwrapResponse(response)
}

export async function requestPasswordReset(email) {
  const response = await db.post('/v1/auth/forgot-password', { email })
  return unwrapResponse(response)
}

export async function getOAuthAuthorizeUrl(provider, redirectUrl) {
  const response = await db.get(`/v1/auth/oauth/${provider}`, {
    params: {
      redirect_url: redirectUrl,
    },
  })

  return unwrapResponse(response)
}

export async function completeOAuthCallback(payload) {
  const response = await db.post('/v1/auth/oauth/callback', payload)
  return unwrapResponse(response)
}

export async function issueDeviceToken() {
  const response = await db.post('/v1/auth/device-token')
  return unwrapResponse(response)
}

export async function syncDeviceToken(deviceToken) {
  const response = await udp.post(resolveUdpApiPath('/api/v1/auth/device-token'), {
    device_token: deviceToken,
  })
  return unwrapResponse(response)
}

export async function listPrintRecords(params = {}) {
  const response = await db.get('/v1/user/print-records', { params })
  return unwrapResponse(response)
}

export async function getPrintRecord(recordId) {
  const response = await db.get(`/v1/user/print-records/${recordId}`)
  return unwrapResponse(response)
}

export async function getPrintRecordModelFile(recordId) {
  const response = await db.get(`/v1/user/print-records/${recordId}/model-file`)
  return unwrapResponse(response)
}

export async function getPrintRecordSliceFile(recordId) {
  const response = await db.get(`/v1/user/print-records/${recordId}/slice-file`)
  return unwrapResponse(response)
}

export async function createPreset(payload) {
  const response = await db.post('/v1/user/presets', payload)
  return unwrapResponse(response)
}

export async function listPresets(params = {}) {
  const response = await db.get('/v1/user/presets', { params })
  return unwrapResponse(response)
}

export async function getPreset(presetId) {
  const response = await db.get(`/v1/user/presets/${presetId}`)
  return unwrapResponse(response)
}

export async function updatePreset(presetId, payload) {
  const response = await db.patch(`/v1/user/presets/${presetId}`, payload)
  return unwrapResponse(response)
}

export async function deletePreset(presetId) {
  await db.delete(`/v1/user/presets/${presetId}`)
}
