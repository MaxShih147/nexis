import { beforeEach, describe, expect, it, vi } from 'vitest'

const udp = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

const db = vi.hoisted(() => ({
  get: vi.fn(),
}))

vi.mock('@/axios/axios.js', () => ({ db, udp }))
vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}))

describe('sendPrintService printer API contract', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('looks up a print record by sdcp_task_id through backend 3', async () => {
    db.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [{ record_id: 42, sdcp_task_id: 'task-001' }],
        },
      },
    })

    const { findRecordByTaskId } = await import('@/axios/sendPrintService')
    const result = await findRecordByTaskId({ sdcpTaskId: 'task-001' })

    expect(db.get).toHaveBeenCalledWith('/v1/user/print-records', {
      params: {
        sdcp_task_id: 'task-001',
        page: 1,
        page_size: 1,
      },
    })
    expect(result).toEqual({
      success: true,
      data: { record_id: 42, sdcp_task_id: 'task-001' },
    })
  })

  it('returns a null record payload when backend 3 has no matching sdcp_task_id', async () => {
    db.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          items: [],
        },
      },
    })

    const { findRecordByTaskId } = await import('@/axios/sendPrintService')
    const result = await findRecordByTaskId({ sdcpTaskId: 'task-missing' })

    expect(result).toEqual({
      success: true,
      data: null,
    })
  })

  it('does not query backend 3 when sdcp_task_id is empty or whitespace', async () => {
    const { findRecordByTaskId } = await import('@/axios/sendPrintService')

    await expect(findRecordByTaskId({ sdcpTaskId: '' })).resolves.toEqual({
      success: true,
      data: null,
    })
    await expect(findRecordByTaskId({ sdcpTaskId: '   ' })).resolves.toEqual({
      success: true,
      data: null,
    })

    expect(db.get).not.toHaveBeenCalled()
  })

  it('checks printer service health through /health with a short timeout', async () => {
    udp.get.mockResolvedValue({
      data: {
        success: true,
        code: 'OK',
        data: { status: 'ok' },
      },
    })

    const { getHealth } = await import('@/axios/sendPrintService')
    const response = await getHealth()

    expect(udp.get).toHaveBeenCalledWith('/health', { timeout: 3000 })
    expect(response.data).toEqual({
      success: true,
      code: 'OK',
      data: { status: 'ok' },
    })
  })

  it('uploads slice file metadata using the account-management multipart contract', async () => {
    udp.post.mockResolvedValue({
      data: {
        success: true,
        data: { record_id: 42, status: 'uploaded' },
      },
    })

    const { uploadFile } = await import('@/axios/sendPrintService')
    const sliceFile = new File(['slice'], 'model.prz', { type: 'application/octet-stream' })
    const modelFile = new File(['model'], 'model.stl', { type: 'model/stl' })

    const result = await uploadFile({
      printerId: 'printer-001',
      sliceFile,
      modelFile,
      mainboardIP: '192.168.1.100',
      machineSlug: 'sonic_ls_plus',
      resinName: 'Dental Ortho Model',
      dentalMode: 'ortho_model',
      filename: 'model.prz',
      slicingParams: { layer_height: 0.05 },
    })

    const [, formData] = udp.post.mock.calls[0]

    expect(udp.post).toHaveBeenCalledWith('/printer-001/files', expect.any(FormData))
    expect(formData.get('slice_file')).toBe(sliceFile)
    expect(formData.get('model_file')).toBe(modelFile)
    expect(formData.get('mainboardIP')).toBe('192.168.1.100')
    expect(formData.get('machine_slug')).toBe('sonic_ls_plus')
    expect(formData.get('resin_name')).toBe('Dental Ortho Model')
    expect(formData.get('dental_mode')).toBe('ortho_model')
    expect(formData.get('filename')).toBe('model.prz')
    expect(formData.get('slicing_params')).toBe('{"layer_height":0.05}')
    expect(result.data).toEqual({ record_id: 42, status: 'uploaded' })
  })

  it('sends an empty slicing_params object when the caller omits slicing metadata', async () => {
    udp.post.mockResolvedValue({
      data: {
        success: true,
        data: { record_id: 43, status: 'uploaded' },
      },
    })

    const { uploadFile } = await import('@/axios/sendPrintService')
    const sliceFile = new File(['slice'], 'manual-upload.ctb', { type: 'application/octet-stream' })

    await uploadFile({
      printerId: 'printer-002',
      sliceFile,
      mainboardIP: '192.168.1.101',
      machineSlug: 'sonic_cs_plus',
      resinName: 'Manual Resin',
      dentalMode: 'Splint',
      filename: 'manual-upload.ctb',
    })

    const [, formData] = udp.post.mock.calls[0]

    expect(formData.get('slicing_params')).toBe('{}')
  })

  it('omits machine_slug, resin_name, and dental_mode when callers pass empty strings', async () => {
    udp.post.mockResolvedValue({
      data: {
        success: true,
        data: { record_id: 44, status: 'uploaded' },
      },
    })

    const { uploadFile } = await import('@/axios/sendPrintService')
    const sliceFile = new File(['slice'], 'no-metadata.prz', { type: 'application/octet-stream' })

    await uploadFile({
      printerId: 'printer-003',
      sliceFile,
      mainboardIP: '192.168.1.102',
      machineSlug: '',
      resinName: '',
      dentalMode: '',
      filename: 'no-metadata.prz',
      slicingParams: {},
    })

    const [, formData] = udp.post.mock.calls[0]

    expect(formData.has('machine_slug')).toBe(false)
    expect(formData.has('resin_name')).toBe(false)
    expect(formData.has('dental_mode')).toBe(false)
  })

  it('starts and stops printing with record_id only when a record id is supplied', async () => {
    udp.post.mockResolvedValue({ data: { success: true, code: 'OK', data: {} } })

    const { startPrinting, stopPrinting } = await import('@/axios/sendPrintService')

    await startPrinting({ printerId: 'printer-001', recordId: 42 })
    await stopPrinting({ printerId: 'printer-001', recordId: 42 })

    expect(udp.post).toHaveBeenNthCalledWith(1, '/printer-001/print', { record_id: 42 })
    expect(udp.post).toHaveBeenNthCalledWith(2, '/printer-001/print/stop', { record_id: 42 })
  })

  it('returns httpStatus in printer error payloads', async () => {
    const httpMsg = 'Conflict'
    const backendMsg = 'This job is completed.'

    udp.post.mockRejectedValue({
      message: httpMsg,
      response: {
        status: 409,
        data: {
          code: 'PRINT_START_FAILED',
          message: backendMsg,
        },
      },
    })

    const { startPrinting } = await import('@/axios/sendPrintService')
    const result = await startPrinting({ printerId: 'printer-001', recordId: 42 })

    expect(result).toEqual({
      success: false,
      code: 'PRINT_START_FAILED',
      details: backendMsg,
      httpStatus: 409,
    })
  })

  it('pauses and resumes printing with mainboard identifiers only', async () => {
    udp.post.mockResolvedValue({ data: { success: true, code: 'OK', data: {} } })

    const { pausePrinting, resumePrinting } = await import('@/axios/sendPrintService')

    await pausePrinting({ mainboardId: 'printer-001', mainboardIP: '192.168.1.100' })
    await resumePrinting({ mainboardId: 'printer-001', mainboardIP: '192.168.1.100' })

    expect(udp.post).toHaveBeenNthCalledWith(1, '/printer-001/print/pause', {
      mainboardID: 'printer-001',
      mainboardIP: '192.168.1.100',
    })
    expect(udp.post).toHaveBeenNthCalledWith(2, '/printer-001/print/resume', {
      mainboardID: 'printer-001',
      mainboardIP: '192.168.1.100',
    })
  })

  it('queues timeout reconciliation through records/sync', async () => {
    udp.post.mockResolvedValue({
      data: {
        success: true,
        code: 'OK',
        data: { queued: true },
      },
    })

    const { syncRecords } = await import('@/axios/sendPrintService')
    const result = await syncRecords({
      printerId: 'printer-001',
      mainboardId: 'CBD1234567890',
      mainboardIP: '192.168.1.100',
    })

    expect(udp.post).toHaveBeenCalledWith('/printer-001/records/sync', {
      mainboardID: 'CBD1234567890',
      mainboardIP: '192.168.1.100',
    })
    expect(result.data).toEqual({ queued: true })
  })
})
