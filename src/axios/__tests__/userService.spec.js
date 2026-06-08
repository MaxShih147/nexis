import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

const udp = vi.hoisted(() => ({
  defaults: {
    baseURL: 'http://localhost:5180/api/v1/printers',
  },
  post: vi.fn(),
}))

vi.mock('@/axios/axios', () => ({ db, udp }))

describe('userService account API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the full health envelope from GET /health', async () => {
    db.get.mockResolvedValue({
      data: {
        success: true,
        code: 'OK',
        data: { status: 'ok' },
      },
    })

    const { getAccountHealth } = await import('@/axios/userService')
    const result = await getAccountHealth()

    expect(db.get).toHaveBeenCalledWith('/health')
    expect(result).toEqual({
      success: true,
      code: 'OK',
      data: { status: 'ok' },
    })
  })

  it('requests a device token with no request body', async () => {
    db.post.mockResolvedValue({
      data: {
        success: true,
        code: 'OK',
        data: { device_token: 'a'.repeat(64) },
      },
    })

    const { issueDeviceToken } = await import('@/axios/userService')
    const result = await issueDeviceToken()

    expect(db.post).toHaveBeenCalledWith('/v1/auth/device-token')
    expect(result).toEqual({ device_token: 'a'.repeat(64) })
  })

  it('syncs the device token to backend 2 through the absolute /api/v1/auth/device-token path', async () => {
    udp.post.mockResolvedValue({
      data: {
        success: true,
        code: 'OK',
        data: {},
      },
    })

    const { syncDeviceToken } = await import('@/axios/userService')
    const result = await syncDeviceToken('a'.repeat(64))

    expect(udp.post).toHaveBeenCalledWith('http://localhost:5180/api/v1/auth/device-token', {
      device_token: 'a'.repeat(64),
    })
    expect(result).toEqual({})
  })

  it('calls print record list, detail, model file, and slice file endpoints', async () => {
    db.get.mockResolvedValue({ data: { success: true, code: 'OK', data: { ok: true } } })

    const {
      getPrintRecord,
      getPrintRecordModelFile,
      getPrintRecordSliceFile,
      listPrintRecords,
    } = await import('@/axios/userService')

    await listPrintRecords({ status: 'success', page: 1 })
    await getPrintRecord(42)
    await getPrintRecordModelFile(42)
    await getPrintRecordSliceFile(42)

    expect(db.get).toHaveBeenNthCalledWith(1, '/v1/user/print-records', {
      params: { status: 'success', page: 1 },
    })
    expect(db.get).toHaveBeenNthCalledWith(2, '/v1/user/print-records/42')
    expect(db.get).toHaveBeenNthCalledWith(3, '/v1/user/print-records/42/model-file')
    expect(db.get).toHaveBeenNthCalledWith(4, '/v1/user/print-records/42/slice-file')
  })

  it('calls preset CRUD endpoints with required contract payloads', async () => {
    db.post.mockResolvedValue({ data: { success: true, code: 'OK', data: { preset_id: 7 } } })
    db.get.mockResolvedValue({ data: { success: true, code: 'OK', data: {} } })
    db.patch.mockResolvedValue({ data: { success: true, code: 'OK', data: { preset_id: 7 } } })
    db.delete.mockResolvedValue({ status: 204 })

    const {
      createPreset,
      deletePreset,
      getPreset,
      listPresets,
      updatePreset,
    } = await import('@/axios/userService')

    const payload = {
      preset_name: 'My Preset',
      machine_slug: 'sonic_ls_plus',
      resin_name: 'Standard',
      slicing_params: {},
    }

    await createPreset(payload)
    await listPresets({ machine_slug: 'sonic_ls_plus' })
    await getPreset(7)
    await updatePreset(7, { preset_name: 'Updated Preset', slicing_params: {} })
    const deleteResult = await deletePreset(7)

    expect(db.post).toHaveBeenCalledWith('/v1/user/presets', payload)
    expect(db.get).toHaveBeenNthCalledWith(1, '/v1/user/presets', {
      params: { machine_slug: 'sonic_ls_plus' },
    })
    expect(db.get).toHaveBeenNthCalledWith(2, '/v1/user/presets/7')
    expect(db.patch).toHaveBeenCalledWith('/v1/user/presets/7', {
      preset_name: 'Updated Preset',
      slicing_params: {},
    })
    expect(db.delete).toHaveBeenCalledWith('/v1/user/presets/7')
    expect(deleteResult).toBeUndefined()
  })
})
