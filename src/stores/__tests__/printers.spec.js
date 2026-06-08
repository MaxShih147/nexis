import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const toast = {
  error: vi.fn(),
  errorKey: vi.fn(),
  success: vi.fn(),
}

const mockLogger = {
  error: vi.fn(),
  log: vi.fn(),
}

const mockPrintService = {
  addMachinesToSubscription: vi.fn(),
  connectPrinter: vi.fn(),
  findRecordByTaskId: vi.fn(),
  getNearbyPrinters: vi.fn(),
  getPrinterStatus: vi.fn(),
  pausePrinting: vi.fn(),
  removeMachinesFromSubscription: vi.fn(),
  resumePrinting: vi.fn(),
  startPrinting: vi.fn(),
  stopPrinting: vi.fn(),
  subscribeToStatus: vi.fn(),
  uploadFile: vi.fn(),
}

vi.mock('@/axios/sendPrintService.js', () => ({
  printService: mockPrintService,
}))

vi.mock('@/composables/useToast.js', () => ({
  useToast: () => toast,
}))

vi.mock('@/utils/logger', () => ({
  logger: mockLogger,
}))

describe('usePrintersStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(mockPrintService).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === 'function')
        mockFn.mockReset()
    })
    Object.values(toast).forEach(mockFn => mockFn.mockReset())
    Object.values(mockLogger).forEach(mockFn => mockFn.mockReset())
  })

  async function createStores() {
    const { usePrintersStore } = await import('@/stores/printers')
    const { useParamsStore } = await import('@/stores/useParamsStore')
    const printersStore = usePrintersStore()
    const paramsStore = useParamsStore()

    paramsStore.uiParams = {
      print: { layerHeight: 0.05 },
      motion: { normal: { liftHeight: 6 } },
    }
    paramsStore.profile = {
      machineName: 'sonic_ls_plus',
      machineLabel: 'Sonic LS Plus',
      resinName: 'Dental Ortho Model',
    }
    paramsStore._rawResinJson = { __dental_mode: 'ortho_model' }

    return { printersStore, paramsStore }
  }

  function samplePrinter() {
    return {
      id: 'printer-001',
      ip: '192.168.1.10',
      status: 'idle',
      job: null,
      allowJobNameFromStatus: true,
    }
  }

  async function flushPromises() {
    await Promise.resolve()
    await Promise.resolve()
  }

  it('stores the uploaded record id and metadata-backed uploaded status after upload', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    const fileItem = {
      file: new File(['slice'], 'case.prz'),
      name: 'case.prz',
      progress: 0,
      status: 'idle',
      error: '',
    }

    mockPrintService.uploadFile.mockResolvedValue({
      success: true,
      data: { record_id: 42, status: 'uploaded' },
    })

    await printersStore.uploadFile(fileItem, printer, {
      machineSlug: 'sonic_ls_plus',
      resinName: 'Dental Ortho Model',
      dentalMode: 'ortho_model',
      slicingParams: { print: { layerHeight: 0.05 } },
    })

    expect(mockPrintService.uploadFile).toHaveBeenCalledWith({
      file: fileItem.file,
      mainboardId: 'printer-001',
      printerId: 'printer-001',
      mainboardIP: '192.168.1.10',
      machineSlug: 'sonic_ls_plus',
      resinName: 'Dental Ortho Model',
      dentalMode: 'ortho_model',
      filename: 'case.prz',
      slicingParams: { print: { layerHeight: 0.05 } },
    })
    expect(fileItem.recordId).toBe(42)
    expect(printer.job.recordId).toBe(42)
    expect(printer.job.status).toBe('uploaded')
    expect(printer.job.liveStatus).toBe('')
  })

  it('uses null/empty values when no metadata provided (no store fallback)', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    const fileItem = {
      file: new File(['slice'], 'case.prz'),
      name: 'case.prz',
      progress: 0,
      status: 'idle',
      error: '',
    }

    mockPrintService.uploadFile.mockResolvedValue({
      success: true,
      data: { record_id: 1, status: 'uploaded' },
    })

    await printersStore.uploadFile(fileItem, printer)

    expect(mockPrintService.uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      machineSlug: null,
      resinName: null,
      dentalMode: null,
      slicingParams: {},
    }))
  })

  it('uses explicit upload metadata values as-is', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    const fileItem = {
      file: new File(['slice'], 'manual-case.prz'),
      name: 'manual-case.prz',
      progress: 0,
      status: 'idle',
      error: '',
    }

    mockPrintService.uploadFile.mockResolvedValue({
      success: true,
      data: { record_id: 99, status: 'uploaded' },
    })

    await printersStore.uploadFile(fileItem, printer, {
      machineSlug: 'sonic_cs_plus',
      resinName: 'Manual Resin',
      dentalMode: 'Surgical Guide',
      slicingParams: {},
    })

    expect(mockPrintService.uploadFile).toHaveBeenCalledWith({
      file: fileItem.file,
      mainboardId: 'printer-001',
      printerId: 'printer-001',
      mainboardIP: '192.168.1.10',
      machineSlug: 'sonic_cs_plus',
      resinName: 'Manual Resin',
      dentalMode: 'Surgical Guide',
      filename: 'manual-case.prz',
      slicingParams: {},
    })
  })

  it('keeps the SSE-derived status when starting printing', async () => {
    const { printersStore } = await createStores()
    const printer = {
      ...samplePrinter(),
      job: {
        name: 'case.prz',
        recordId: 42,
        status: 'uploaded',
        error: '',
      },
    }

    mockPrintService.startPrinting.mockResolvedValue({ success: true, data: { status: 'uploaded' } })

    await printersStore.startPrinting(printer)

    expect(mockPrintService.startPrinting).toHaveBeenCalledWith({
      printerId: 'printer-001',
      mainboardId: 'printer-001',
      recordId: 42,
    })
    expect(printer.status).toBe('idle')
    expect(printer.job.status).toBe('uploaded')
  })

  it('shows a re-upload message when start printing fails with 409', async () => {
    const { printersStore } = await createStores()
    const printer = {
      ...samplePrinter(),
      job: {
        name: 'case.prz',
        recordId: 42,
        status: 'uploaded',
        error: '',
      },
    }

    mockPrintService.startPrinting.mockResolvedValue({
      success: false,
      code: 'PRINT_START_FAILED',
      details: 'This job is completed.',
      httpStatus: 409,
    })

    await expect(printersStore.startPrinting(printer)).rejects.toMatchObject({
      httpStatus: 409,
    })

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.completedReuploadRequired',
    })
    expect(printer.job.status).toBe('uploaded')
  })

  function stoppablePrinter() {
    return {
      ...samplePrinter(),
      status: 'printing',
      job: {
        name: 'case.prz',
        recordId: 42,
        status: 'uploaded',
        liveStatus: 'printing',
        error: '',
        progress: 50,
      },
    }
  }

  it('stops printing by record id and sets job status from the response data.status', async () => {
    const { printersStore } = await createStores()
    const printer = stoppablePrinter()

    mockPrintService.stopPrinting.mockResolvedValue({ success: true, data: { status: 'stopping' } })

    await printersStore.stopPrinting(printer)

    expect(mockPrintService.stopPrinting).toHaveBeenCalledWith({
      printerId: 'printer-001',
      mainboardId: 'printer-001',
      mainboardIP: '192.168.1.10',
      recordId: 42,
    })
    // printer.status is SSE-driven and must not be touched by the action.
    expect(printer.status).toBe('printing')
    expect(printer.job.status).toBe('stopping')
    expect(printer.job.liveStatus).toBe('printing')
    expect(printer.job.progress).toBe(50)
  })

  it('sets job status to canceled when that is what the response data.status carries', async () => {
    const { printersStore } = await createStores()
    const printer = stoppablePrinter()

    mockPrintService.stopPrinting.mockResolvedValue({ success: true, data: { status: 'canceled' } })

    await printersStore.stopPrinting(printer)

    // 'canceled' is sourced from the response, not hardcoded by the action.
    expect(printer.status).toBe('printing')
    expect(printer.job.status).toBe('canceled')
  })

  it('keeps the previous job status when the stop response has no data.status', async () => {
    const { printersStore } = await createStores()
    const printer = stoppablePrinter()

    mockPrintService.stopPrinting.mockResolvedValue({ success: true, data: {} })

    await printersStore.stopPrinting(printer)

    expect(printer.status).toBe('printing')
    expect(printer.job.status).toBe('uploaded')
  })

  it('does not change job status when stopping fails', async () => {
    const { printersStore } = await createStores()
    const printer = stoppablePrinter()

    mockPrintService.stopPrinting.mockResolvedValue({ success: false, message: 'boom' })

    await printersStore.stopPrinting(printer)

    expect(printer.status).toBe('printing')
    expect(printer.job.status).toBe('uploaded')
    expect(printer.job.error).toBeTruthy()
  })

  it('does not let SSE printStatus overwrite the record status', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    printer.job = {
      name: 'case.prz',
      recordId: 42,
      record_id: 42,
      status: 'uploaded',
      liveStatus: '',
      error: '',
      currentLayer: 0,
      totalLayer: 0,
    }

    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        currentLayer: 15,
        totalLayer: 100,
      }],
    })

    expect(printer.status).toBe('paused')
    expect(printer.job.status).toBe('uploaded')
    expect(printer.job.liveStatus).toBe('paused')
  })

  it('treats detailed machine printing phases as printing jobs', async () => {
    const { isPrintingStatus } = await import('@/stores/printers')

    expect(isPrintingStatus('homing')).toBe(true)
    expect(isPrintingStatus('dropping')).toBe(true)
    expect(isPrintingStatus('exposuring')).toBe(true)
    expect(isPrintingStatus('lifting')).toBe(true)
    expect(isPrintingStatus('printing')).toBe(true)
    expect(isPrintingStatus('file checking')).toBe(true)
    expect(isPrintingStatus('paused')).toBe(false)
    expect(isPrintingStatus('idle')).toBe(false)
    expect(isPrintingStatus('offline')).toBe(false)
  })

  it('resolves record id from sdcp task id when status updates arrive after subscribe', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })
    mockPrintService.findRecordByTaskId.mockResolvedValue({
      success: true,
      data: { record_id: 77, sdcp_task_id: 'task-001' },
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        taskId: 'task-001',
        currentLayer: 15,
        totalLayer: 100,
      }],
    })
    await flushPromises()

    expect(mockPrintService.findRecordByTaskId).toHaveBeenCalledWith({
      sdcpTaskId: 'task-001',
    })
    expect(printer.job.taskId).toBe('task-001')
    expect(printer.job.recordId).toBe(77)
    expect(printer.job.record_id).toBe(77)
  })

  it('does not look up a print record before any status update provides taskId', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        currentLayer: 15,
        totalLayer: 100,
      }],
    })
    await flushPromises()

    expect(mockPrintService.findRecordByTaskId).not.toHaveBeenCalled()
    expect(printer.job.taskId).toBeUndefined()
  })

  it('does not look up a print record when status updates provide an empty taskId', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        taskId: '   ',
        currentLayer: 15,
        totalLayer: 100,
      }],
    })
    await flushPromises()

    expect(mockPrintService.findRecordByTaskId).not.toHaveBeenCalled()
    expect(printer.job.taskId).toBeUndefined()
    expect(printer.job.task_id).toBeUndefined()
  })

  it('logs each subscription status update payload for debug tracing', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        currentLayer: 15,
        totalLayer: 100,
      }],
    })

    expect(mockLogger.log).toHaveBeenCalledWith(
      '[printers] subscription status-update',
      expect.objectContaining({
        clientId: 'sub-1',
        payload: expect.objectContaining({
          mainboardIP: '192.168.1.10',
          mainboardID: 'printer-001',
        }),
      }),
    )
  })

  it('preserves record id across pause and later status updates', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    let statusHandlers

    mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
    mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
      statusHandlers = handlers
      return { close: vi.fn() }
    })
    mockPrintService.pausePrinting.mockResolvedValue({ success: true, data: {} })
    mockPrintService.findRecordByTaskId.mockResolvedValue({
      success: true,
      data: { record_id: 42, sdcp_task_id: 'task-001' },
    })

    await printersStore.connectPrinter(printer)
    statusHandlers.onConnected({ clientId: 'sub-1' })
    printer.status = 'printing'
    printer.job = {
      name: 'case.prz',
      recordId: 42,
      record_id: 42,
      taskId: 'task-001',
      task_id: 'task-001',
      status: 'printing',
      error: '',
      currentLayer: 50,
      totalLayer: 100,
    }
    await printersStore.pausePrinting(printer)
    statusHandlers.onStatusUpdate({
      machines: [{
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
        currentStatus: 'Printing',
        printStatus: 'Paused',
        filename: 'case.prz',
        taskId: 'task-001',
        currentLayer: 51,
        totalLayer: 100,
      }],
    })
    await flushPromises()

    expect(mockPrintService.findRecordByTaskId).not.toHaveBeenCalled()
    expect(printer.job.recordId).toBe(42)
    expect(printer.job.record_id).toBe(42)
    expect(printer.job.taskId).toBe('task-001')
    expect(printer.job.task_id).toBe('task-001')
    expect(printer.job.currentLayer).toBe(51)
  })

  it('keeps the SSE-derived status after pause succeeds', async () => {
    const { printersStore } = await createStores()
    const printer = {
      ...samplePrinter(),
      status: 'printing',
      job: {
        name: 'case.prz',
        status: 'printing',
        error: '',
      },
    }

    mockPrintService.pausePrinting.mockResolvedValue({ success: true, data: {} })

    await printersStore.pausePrinting(printer)

    expect(mockPrintService.pausePrinting).toHaveBeenCalledWith({
      mainboardId: 'printer-001',
      mainboardIP: '192.168.1.10',
    })
    expect(printer.status).toBe('printing')
  })

  it('keeps the SSE-derived status after resume succeeds', async () => {
    const { printersStore } = await createStores()
    const printer = {
      ...samplePrinter(),
      status: 'paused',
      job: {
        name: 'case.prz',
        status: 'paused',
        error: '',
      },
    }

    mockPrintService.resumePrinting.mockResolvedValue({ success: true, data: {} })

    await printersStore.resumePrinting(printer)

    expect(mockPrintService.resumePrinting).toHaveBeenCalledWith({
      mainboardId: 'printer-001',
      mainboardIP: '192.168.1.10',
    })
    expect(printer.status).toBe('paused')
  })

  it('sets status to offline when connecting fails', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    printer.status = 'offline'

    mockPrintService.connectPrinter.mockResolvedValue({ success: false })

    await printersStore.connectPrinter(printer)

    expect(printer.status).toBe('offline')
  })

  it('updates status and job from the connect response (same shape as SSE)', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    printer.status = 'offline'

    mockPrintService.connectPrinter.mockResolvedValue({
      success: true,
      data: {
        currentStatus: 'Idle',
        printStatus: 'Idle',
        filename: '',
        taskId: '',
        currentLayer: null,
        totalLayer: null,
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
      },
    })
    mockPrintService.subscribeToStatus.mockReturnValue({ close: vi.fn() })

    await printersStore.connectPrinter(printer)

    // backend SSE does not push at connect time; seed from the response instead
    expect(printer.status).toBe('idle')
    expect(printer.job).toBeTruthy()
  })

  it('maps a printing connect response via the SSE rules', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    printer.status = 'offline'

    mockPrintService.connectPrinter.mockResolvedValue({
      success: true,
      data: {
        currentStatus: 'printing',
        printStatus: 'homing',
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
      },
    })
    mockPrintService.subscribeToStatus.mockReturnValue({ close: vi.fn() })

    await printersStore.connectPrinter(printer)

    expect(printer.status).toBe('homing')
    expect(printer.job.liveStatus).toBe('homing')
  })

  it('does not crash when connect response omits layer/filename', async () => {
    const { printersStore } = await createStores()
    const printer = samplePrinter()
    printer.status = 'offline'

    mockPrintService.connectPrinter.mockResolvedValue({
      success: true,
      data: {
        currentStatus: 'Idle',
        printStatus: 'Idle',
        currentLayer: null,
        totalLayer: null,
        filename: '',
        mainboardIP: '192.168.1.10',
        mainboardID: 'printer-001',
      },
    })
    mockPrintService.subscribeToStatus.mockReturnValue({ close: vi.fn() })

    await printersStore.connectPrinter(printer)

    expect(printer.status).toBe('idle')
    expect(printer.job.currentLayer).toBe(0)
    expect(printer.job.totalLayer).toBe(0)
  })

  describe('_normalizeStatus (SSE map via onStatusUpdate)', () => {
    async function connectedPrinterWithStream() {
      const { printersStore } = await createStores()
      const printer = samplePrinter()
      let statusHandlers
      mockPrintService.connectPrinter.mockResolvedValue({ success: true, data: {} })
      mockPrintService.subscribeToStatus.mockImplementation((handlers) => {
        statusHandlers = handlers
        return { close: vi.fn() }
      })
      await printersStore.connectPrinter(printer)
      statusHandlers.onConnected({ clientId: 'sub-1' })
      const send = update => statusHandlers.onStatusUpdate({
        machines: [{ mainboardIP: '192.168.1.10', mainboardID: 'printer-001', ...update }],
      })
      return { printer, send }
    }

    const cases = [
      { currentStatus: 'idle', printStatus: '', expected: 'idle' },
      { currentStatus: 'file transfer', printStatus: '', expected: 'file transfer' },
      { currentStatus: 'exposure test', printStatus: '', expected: 'exposure test' },
      { currentStatus: 'devices testing', printStatus: '', expected: 'devices testing' },
      { currentStatus: 'offline', printStatus: 'paused', expected: 'offline' },
      { currentStatus: 'offline', printStatus: '', expected: 'offline' },
      { currentStatus: 'printing', printStatus: 'homing', expected: 'homing' },
      { currentStatus: 'printing', printStatus: 'file checking', expected: 'file checking' },
      { currentStatus: 'printing', printStatus: 'pausing', expected: 'pausing' },
      { currentStatus: 'printing', printStatus: 'paused', expected: 'paused' },
      { currentStatus: 'printing', printStatus: 'stopping', expected: 'stopping' },
      { currentStatus: 'printing', printStatus: 'stoped', expected: 'idle' },
      { currentStatus: 'printing', printStatus: 'complete', expected: 'idle' },
      { currentStatus: 'printing', printStatus: 'print completed', expected: 'idle' },
      { currentStatus: 'printing', printStatus: 'idle', expected: 'idle' },
      { currentStatus: 'printing', printStatus: '', expected: 'printing' },
      // case-insensitive / whitespace tolerant
      { currentStatus: 'Printing', printStatus: 'Paused', expected: 'paused' },
    ]

    for (const { currentStatus, printStatus, expected } of cases) {
      it(`maps (${currentStatus}, ${printStatus || '∅'}) -> ${expected}`, async () => {
        const { printer, send } = await connectedPrinterWithStream()
        send({ currentStatus, printStatus })
        expect(printer.status).toBe(expected)
      })
    }
  })
})

describe('error code i18n key mapping', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    Object.values(mockPrintService).forEach((mockFn) => {
      if (typeof mockFn?.mockReset === 'function')
        mockFn.mockReset()
    })
    Object.values(toast).forEach(mockFn => mockFn.mockReset())
    Object.values(mockLogger).forEach(mockFn => mockFn.mockReset())
  })

  async function createStores() {
    const { usePrintersStore } = await import('@/stores/printers')
    const { useParamsStore } = await import('@/stores/useParamsStore')
    const printersStore = usePrintersStore()
    const paramsStore = useParamsStore()
    paramsStore.uiParams = { print: { layerHeight: 0.05 }, motion: { normal: { liftHeight: 6 } } }
    paramsStore.profile = { machineName: 'sonic_ls_plus', machineLabel: 'Sonic LS Plus', resinName: 'Dental Ortho Model' }
    paramsStore._rawResinJson = { __dental_mode: 'ortho_model' }
    return { printersStore }
  }

  function printerWithJob() {
    return {
      id: 'printer-001',
      ip: '192.168.1.100',
      status: 'idle',
      job: { name: 'case.prz', recordId: 42, status: 'uploaded', error: '' },
    }
  }

  it('maps RECORD_NOT_PRINTABLE to errors.printer.recordNotPrintable for startPrinting', async () => {
    const { printersStore } = await createStores()
    mockPrintService.startPrinting.mockResolvedValue({ success: false, code: 'RECORD_NOT_PRINTABLE', httpStatus: 409 })

    await expect(printersStore.startPrinting(printerWithJob())).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.recordNotPrintable',
    })
  })

  it('maps RECORD_NOT_FOUND to errors.printer.recordNotFound for startPrinting', async () => {
    const { printersStore } = await createStores()
    mockPrintService.startPrinting.mockResolvedValue({ success: false, code: 'RECORD_NOT_FOUND', httpStatus: 404 })

    await expect(printersStore.startPrinting(printerWithJob())).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.recordNotFound',
    })
  })

  it('maps TOKEN_MISSING to errors.printer.tokenMissing for startPrinting', async () => {
    const { printersStore } = await createStores()
    mockPrintService.startPrinting.mockResolvedValue({ success: false, code: 'TOKEN_MISSING', httpStatus: 401 })

    await expect(printersStore.startPrinting(printerWithJob())).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.tokenMissing',
    })
  })

  it('still maps httpStatus 409 PRINT_START_FAILED to completedReuploadRequired', async () => {
    const { printersStore } = await createStores()
    mockPrintService.startPrinting.mockResolvedValue({ success: false, code: 'PRINT_START_FAILED', httpStatus: 409 })

    await expect(printersStore.startPrinting(printerWithJob())).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.completedReuploadRequired',
    })
  })

  it('falls back to startFailed for unknown error codes in startPrinting', async () => {
    const { printersStore } = await createStores()
    mockPrintService.startPrinting.mockResolvedValue({ success: false, code: 'UNKNOWN_CODE_XYZ', httpStatus: 500 })

    await expect(printersStore.startPrinting(printerWithJob())).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.startFailed',
    })
  })

  it('maps PRINT_PAUSE_FAILED code to errors.printer.printPauseFailed for pausePrinting', async () => {
    const { printersStore } = await createStores()
    const printer = { ...printerWithJob(), status: 'printing' }
    mockPrintService.pausePrinting.mockResolvedValue({ success: false, code: 'PRINT_PAUSE_FAILED', httpStatus: 500 })

    await printersStore.pausePrinting(printer)

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.printPauseFailed',
    })
  })

  it('falls back to pauseFailed for unknown codes in pausePrinting', async () => {
    const { printersStore } = await createStores()
    const printer = { ...printerWithJob(), status: 'printing' }
    mockPrintService.pausePrinting.mockResolvedValue({ success: false, code: 'UNKNOWN_XYZ', httpStatus: 500 })

    await printersStore.pausePrinting(printer)

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.pauseFailed',
    })
  })

  it('maps MAINBOARD_ID_REQUIRED to errors.printer.mainboardIdRequired for stopPrinting', async () => {
    const { printersStore } = await createStores()
    const printer = { ...printerWithJob(), status: 'printing' }
    mockPrintService.stopPrinting.mockResolvedValue({ success: false, code: 'MAINBOARD_ID_REQUIRED', httpStatus: 400 })

    await printersStore.stopPrinting(printer)

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.mainboardIdRequired',
    })
  })

  it('maps PRINT_RESUME_FAILED to errors.printer.printResumeFailed for resumePrinting', async () => {
    const { printersStore } = await createStores()
    const printer = { ...printerWithJob(), status: 'paused' }
    mockPrintService.resumePrinting.mockResolvedValue({ success: false, code: 'PRINT_RESUME_FAILED', httpStatus: 500 })

    await printersStore.resumePrinting(printer)

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.printResumeFailed',
    })
  })

  it('falls back to resumeFailed for unknown codes in resumePrinting', async () => {
    const { printersStore } = await createStores()
    const printer = { ...printerWithJob(), status: 'paused' }
    mockPrintService.resumePrinting.mockResolvedValue({ success: false, code: 'UNKNOWN_XYZ', httpStatus: 500 })

    await printersStore.resumePrinting(printer)

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.resumeFailed',
    })
  })

  it('maps INVALID_FILE_TYPE to errors.printer.invalidFileType for uploadFile', async () => {
    const { printersStore } = await createStores()
    const fileItem = { file: new File(['x'], 'test.prz'), status: 'pending', progress: 0 }
    const printer = { ...printerWithJob(), status: 'idle' }
    mockPrintService.uploadFile.mockResolvedValue({ success: false, code: 'INVALID_FILE_TYPE', httpStatus: 400 })

    await expect(printersStore.uploadFile(fileItem, printer)).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.invalidFileType',
    })
  })

  it('maps LIMIT_FILE_SIZE to errors.printer.limitFileSize for uploadFile', async () => {
    const { printersStore } = await createStores()
    const fileItem = { file: new File(['x'], 'big.prz'), status: 'pending', progress: 0 }
    const printer = { ...printerWithJob(), status: 'idle' }
    mockPrintService.uploadFile.mockResolvedValue({ success: false, code: 'LIMIT_FILE_SIZE', httpStatus: 400 })

    await expect(printersStore.uploadFile(fileItem, printer)).rejects.toBeTruthy()

    expect(toast.errorKey).toHaveBeenCalledWith('errors.printer.failed', {
      detailKey: 'errors.printer.limitFileSize',
    })
  })
})

describe('KNOWN_PRINTER_ERROR_CODES', () => {
  it('covers exactly the codes that correspond to REQUIRED_PRINTER_ERROR_KEYS', async () => {
    const { KNOWN_PRINTER_ERROR_CODES } = await import('@/stores/printers')
    const expectedCamelKeys = [
      'tokenMissing', 'tokenInvalid', 'tokenRequired',
      'deviceTokenMissing', 'deviceTokenInvalid',
      'printerIdRequired', 'fileRequired', 'filePathRequired',
      'mainboardIpRequired', 'invalidIpAddress',
      'machineSlugRequired', 'resinNameRequired', 'dentalModeRequired',
      'invalidFileType', 'limitFileSize', 'limitFileCount', 'limitUnexpectedFile',
      'badRequest', 'fileUploadFailed', 'recordCreateFailed',
      'recordIdRequired', 'recordNotFound', 'recordNotPrintable',
      'printCommandFailed', 'recordUpdateFailed', 'printerAckError',
      'mainboardIdRequired', 'printPauseFailed', 'printResumeFailed',
      'printStopFailed', 'recordSyncFailed',
    ]

    for (const camel of expectedCamelKeys) {
      const snake = camel.replace(/([A-Z])/g, '_$1').toUpperCase()
      expect(KNOWN_PRINTER_ERROR_CODES.has(snake), `${snake} missing from KNOWN_PRINTER_ERROR_CODES`).toBe(true)
    }
    expect(KNOWN_PRINTER_ERROR_CODES.size).toBe(expectedCamelKeys.length)
  })
})
