import { printService } from '@/axios/sendPrintService.js'
import { useToast } from '@/composables/useToast.js'
import i18n from '@/i18n'
import { logger } from '@/utils/logger'
import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

const t = (...args) => i18n.global.t(...args)
const PRINTING_STATUSES = ['homing', 'dropping', 'exposuring', 'lifting', 'printing', 'file checking']
// printStatus values (under currentStatus === 'printing') that resolve to idle
const PRINT_IDLE_STATUSES = ['stoped', 'stopped', 'complete', 'completed', 'print completed', 'idle']

export const KNOWN_PRINTER_ERROR_CODES = new Set([
  'TOKEN_MISSING',
  'TOKEN_INVALID',
  'TOKEN_REQUIRED',
  'DEVICE_TOKEN_MISSING',
  'DEVICE_TOKEN_INVALID',
  'PRINTER_ID_REQUIRED',
  'FILE_REQUIRED',
  'FILE_PATH_REQUIRED',
  'MAINBOARD_IP_REQUIRED',
  'INVALID_IP_ADDRESS',
  'MACHINE_SLUG_REQUIRED',
  'RESIN_NAME_REQUIRED',
  'DENTAL_MODE_REQUIRED',
  'INVALID_FILE_TYPE',
  'LIMIT_FILE_SIZE',
  'LIMIT_FILE_COUNT',
  'LIMIT_UNEXPECTED_FILE',
  'BAD_REQUEST',
  'FILE_UPLOAD_FAILED',
  'RECORD_CREATE_FAILED',
  'RECORD_ID_REQUIRED',
  'RECORD_NOT_FOUND',
  'RECORD_NOT_PRINTABLE',
  'PRINT_COMMAND_FAILED',
  'RECORD_UPDATE_FAILED',
  'PRINTER_ACK_ERROR',
  'MAINBOARD_ID_REQUIRED',
  'PRINT_PAUSE_FAILED',
  'PRINT_RESUME_FAILED',
  'PRINT_STOP_FAILED',
  'RECORD_SYNC_FAILED',
])

function getErrorI18nKey(code) {
  if (!code || !KNOWN_PRINTER_ERROR_CODES.has(code))
    return null
  const camel = code.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  return `errors.printer.${camel}`
}

function getPrintActionErrorDetails(resultOrError) {
  return resultOrError?.details || resultOrError?.message || resultOrError?.code || ''
}

function showPrinterErrorToast(detailKey) {
  useToast().errorKey('errors.printer.failed', { detailKey })
}

function getStartPrintErrorDetailKey(resultOrError) {
  const codeKey = getErrorI18nKey(resultOrError?.code)
  if (codeKey)
    return codeKey
  if (resultOrError?.httpStatus === 409)
    return 'errors.printer.completedReuploadRequired'
  return 'errors.printer.startFailed'
}

function normalizeRecordId(recordId) {
  return recordId ?? null
}

function normalizeTaskId(taskId) {
  if (taskId === null || taskId === undefined)
    return null
  if (typeof taskId === 'string') {
    const trimmedTaskId = taskId.trim()
    return trimmedTaskId === '' ? null : trimmedTaskId
  }
  return taskId
}

export function normalizeStatus(status) {
  if (status === null || status === undefined)
    return ''
  return status.toString().trim().toLowerCase()
}

function readRecordId(source) {
  return normalizeRecordId(
    source?.recordId
    ?? source?.record_id,
  )
}

function readTaskId(source) {
  return normalizeTaskId(
    source?.taskId
    ?? source?.task_id
    ?? source?.sdcpTaskId
    ?? source?.sdcp_task_id,
  )
}

export function isPrintingStatus(status) {
  return PRINTING_STATUSES.includes((status || '').toString().toLowerCase().trim())
}

export const usePrintersStore = defineStore('printers', () => {
  const nearbyPrinters = reactive([])
  const historyPrinters = reactive([])
  const isSearching = ref(false)
  // status is SSE-driven (see _normalizeStatus); 'connecting' and 'error' are
  // retained for backward references but no longer assigned by the store.
  const printerStatus = {
    connecting: 'connecting',
    idle: 'idle',
    printing: 'printing',
    paused: 'paused',
    disconnected: 'offline',
    error: 'error',
  }

  // Simplified subscription state
  const subscription = reactive({ clientId: null, machines: [] }) // machines: string[] of IPs
  let closeSubscription = null
  const offlineTimers = new Map() // ip -> timeout id
  const pendingRecordLookups = new Map()

  function _addUnique(objToAdd, arr, key) {
    const isDuplicate = arr.some(item => item[key] === objToAdd[key])
    if (!isDuplicate)
      arr.push(objToAdd)
    return arr
  }

  function getPrinter(ip) {
    return historyPrinters.find(p => p.ip === ip) || nearbyPrinters.find(p => p.ip === ip)
  }

  // Resolves once the printer reaches the target status (driven by the SSE
  // stream) or the timeout elapses. Returns whether the target was reached.
  function _waitForStatus(printer, target, timeoutMs = 8000, intervalMs = 200) {
    return new Promise((resolve) => {
      const start = Date.now()
      const tick = () => {
        const current = getPrinter(printer.ip) || printer
        if (current.status === target)
          return resolve(true)
        if (Date.now() - start >= timeoutMs)
          return resolve(false)
        setTimeout(tick, intervalMs)
      }
      tick()
    })
  }

  function _isSubscribed(ip) {
    return subscription.machines.includes(ip)
  }

  function _listHistoryMachines() {
    return historyPrinters.map(p => ({ mainboardIP: p.ip, mainboardID: p.id }))
  }

  function _upsertInLists(ip, updater) {
    const lists = [historyPrinters, nearbyPrinters]
    for (const list of lists) {
      const idx = list.findIndex(p => p.ip === ip)
      if (idx !== -1)
        updater(list[idx])
    }
  }

  function _getJobRecordId(printer) {
    return normalizeRecordId(
      printer?.job?.recordId
      ?? printer?.job?.record_id
      ?? printer?.recordId
      ?? printer?.record_id,
    )
  }

  function _getJobTaskId(printer) {
    return normalizeTaskId(
      printer?.job?.taskId
      ?? printer?.job?.task_id
      ?? printer?.job?.sdcpTaskId
      ?? printer?.job?.sdcp_task_id
      ?? printer?.taskId
      ?? printer?.task_id
      ?? printer?.sdcpTaskId
      ?? printer?.sdcp_task_id,
    )
  }

  function _mergeJobIdentity(target, ...sources) {
    if (!target)
      return target

    const mergedRecordId = normalizeRecordId(
      sources.map(readRecordId).find(value => value !== null)
      ?? readRecordId(target),
    )
    const mergedTaskId = normalizeTaskId(
      sources.map(readTaskId).find(value => value !== null)
      ?? readTaskId(target),
    )

    if (mergedRecordId !== null) {
      target.recordId = mergedRecordId
      target.record_id = mergedRecordId
    }

    if (mergedTaskId !== null) {
      target.taskId = mergedTaskId
      target.task_id = mergedTaskId
      target.sdcpTaskId = mergedTaskId
      target.sdcp_task_id = mergedTaskId
    }

    return target
  }

  function _logSubscriptionEvent(eventType, payload) {
    logger.log(`[printers] subscription ${eventType}`, {
      clientId: subscription.clientId,
      payload,
    })
  }

  async function _resolveRecordIdByTask(printer, taskId) {
    if (!printer?.ip || taskId === null)
      return

    const lookupKey = `${printer.ip}:${String(taskId)}`
    if (pendingRecordLookups.has(lookupKey))
      return pendingRecordLookups.get(lookupKey)

    const lookupPromise = (async () => {
      try {
        const result = await printService.findRecordByTaskId({ sdcpTaskId: taskId })
        if (!result?.success || !result?.data)
          return

        const currentPrinter = getPrinter(printer.ip)
        if (!currentPrinter?.job)
          return
        if (_getJobTaskId(currentPrinter) !== taskId)
          return

        _mergeJobIdentity(currentPrinter.job, result.data)
      }
      catch (error) {
        logger.error(error)
      }
      finally {
        pendingRecordLookups.delete(lookupKey)
      }
    })()

    pendingRecordLookups.set(lookupKey, lookupPromise)
    return lookupPromise
  }

  // Maps the backend SSE (currentStatus, printStatus) pair to printer.status.
  // 'printing' delegates to printStatus; terminal print phases collapse to idle.
  function _normalizeStatus(update) {
    const current = (update?.currentStatus || '').toString().toLowerCase().trim()
    const print = (update?.printStatus || '').toString().toLowerCase().trim()

    // offline overrides any printStatus
    if (current === 'offline')
      return printerStatus.disconnected

    if (current === 'printing') {
      if (!print)
        return printerStatus.printing
      if (PRINT_IDLE_STATUSES.includes(print))
        return printerStatus.idle
      return print // homing, file checking, pausing, paused, stopping, ...
    }

    // idle, file transfer, exposure test, devices testing pass through as-is
    return current
  }

  function _onStatus(payload) {
    if (!payload)
      return
    const updates = Array.isArray(payload?.machines) ? payload.machines : (Array.isArray(payload) ? payload : [payload])
    for (const u of updates) {
      _logSubscriptionEvent('status-update', u)
      const ip = u?.mainboardIP
      const id = u?.mainboardID
      if (!ip)
        continue
      const status = _normalizeStatus(u)
      _upsertInLists(ip, (printer) => {
        const previousIdentity = {
          recordId: _getJobRecordId(printer),
          taskId: _getJobTaskId(printer),
        }
        const updateIdentity = {
          taskId: readTaskId(u),
        }

        if (id && !printer.id)
          printer.id = id
        printer.status = status

        // Initialize job object if it doesn't exist but we have layer info
        if (!printer.job && ((u?.currentLayer !== undefined && u?.currentLayer !== null) || (u?.totalLayer !== undefined && u?.totalLayer !== null) || u?.filename)) {
          printer.job = {
            name: u?.filename || '',
            status: '',
            liveStatus: normalizeStatus(u?.printStatus),
            progress: 0,
            error: '',
            currentLayer: 0,
            totalLayer: 0,
          }
        }

        if (printer.job) {
          _mergeJobIdentity(printer.job, previousIdentity, updateIdentity)
          if (printer.allowJobNameFromStatus) {
            printer.job.name = u?.filename || printer.job.name
          }
          printer.job.liveStatus = normalizeStatus(u?.printStatus) || printer.job.liveStatus || ''
          // Default currentLayer to 0 if not provided and machine is not disconnected
          if (u?.currentLayer !== undefined && u?.currentLayer !== null) {
            printer.job.currentLayer = u.currentLayer
          }
          else if (status !== printerStatus.disconnected) {
            printer.job.currentLayer = 0
          }
          printer.job.totalLayer = u?.totalLayer !== undefined && u?.totalLayer !== null ? u.totalLayer : (printer.job.totalLayer || 0)
        }
      })

      const currentPrinter = getPrinter(ip)
      const taskId = _getJobTaskId(currentPrinter)
      if (currentPrinter?.job && taskId !== null && _getJobRecordId(currentPrinter) === null)
        void _resolveRecordIdByTask(currentPrinter, taskId)

      if (status === printerStatus.disconnected)
        _scheduleOfflineRecheck(ip)
    }
  }

  function _startSubscription() {
    if (subscription.clientId || closeSubscription)
      return
    const machines = _listHistoryMachines()
    if (!machines.length)
      return

    const handle = printService.subscribeToStatus({
      machines,
      onConnected: (data) => {
        _logSubscriptionEvent('connected', data)
        subscription.clientId = data?.clientId || null
        subscription.machines = historyPrinters.map(p => p.ip)
      },
      onStatusUpdate: data => _onStatus(data),
      onSubscriptionUpdated: (data) => {
        _logSubscriptionEvent('subscription-updated', data)
      },
      onError: (err) => {
        logger.error(err)
        useToast().error(t('common.messages.statusStreamError'))
      },
    })

    closeSubscription = handle?.close || null
  }

  async function _ensureMachineSubscribed(printer) {
    if (!printer?.ip)
      return
    // If no subscription yet, start one for all history
    if (!subscription.clientId) {
      _startSubscription()
      return
    }
    // If machine is already subscribed, do nothing
    if (_isSubscribed(printer.ip))
      return
    try {
      const res = await printService.addMachinesToSubscription({
        clientId: subscription.clientId,
        machines: [{ mainboardIP: printer.ip, mainboardID: printer.id }],
      })
      if (res?.success !== false)
        subscription.machines.push(printer.ip)
    }
    catch (err) {
      logger.error(err)
      useToast().error(t('common.messages.subscriptionAddFailed'))
    }
  }

  function _scheduleOfflineRecheck(ip) {
    if (offlineTimers.has(ip))
      return
    const timer = setTimeout(async () => {
      offlineTimers.delete(ip)
      try {
        const target = getPrinter(ip)
        if (!target)
          return
        const res = await printService.getPrinterStatus({ mainboardId: target.id, mainboardIP: ip })
        const stillOffline = !res?.success || _normalizeStatus(res?.data || res) === printerStatus.disconnected
        if (stillOffline && subscription.clientId) {
          await printService.removeMachinesFromSubscription({
            clientId: subscription.clientId,
            machines: [{ mainboardIP: ip, mainboardID: target.id }],
          })
          subscription.machines = subscription.machines.filter(mIp => mIp !== ip)
        }
      }
      catch {}
    }, 3000)
    offlineTimers.set(ip, timer)
  }

  async function getNearbyPrinters() {
    isSearching.value = true
    nearbyPrinters.length = 0
    await printService.getNearbyPrinters()
      .then((res) => {
        if (!res.success) {
          throw res
        }
        // Handle the new API response structure: res.data.printers
        const printersData = res.data?.printers || res.printers || []
        const printers = printersData.map((printer) => {
          const info = printer?.info || {}
          const name = info.Name ?? info.MachineName ?? info.MainboardIP ?? ''
          const newPrinter = {
            id: info.MainboardID,
            ip: info.MainboardIP,
            name: typeof name === 'string' ? name : String(name),
            model: info.MachineName,
            firmware: info.FirmwareVersion,
            brand: info.BrandName,
            port: info.Port || 3030,
            status: printerStatus.disconnected,
            job: null,
            error: null,
            progress: 0,
            allowJobNameFromStatus: true,
          }

          // Check if printer exists in history and update status
          const historyPrinter = historyPrinters.find(p => p.id === newPrinter.id)
          if (historyPrinter) {
            newPrinter.status = historyPrinter.status
            newPrinter.job = historyPrinter.job
            newPrinter.error = historyPrinter.error
            newPrinter.progress = historyPrinter.progress
            newPrinter.allowJobNameFromStatus = historyPrinter.allowJobNameFromStatus !== false
          }

          return newPrinter
        })
        printers.forEach(printer => _addUnique(printer, nearbyPrinters, 'id'))
        isSearching.value = false
      })
      .catch((err) => {
        logger.error(err)
        showPrinterErrorToast('errors.printer.discoveryFailed')
        isSearching.value = false
      })
  }

  async function connectPrinter(printer) {
    if (!printer.ip) {
      useToast().error(t('common.messages.provideIpAddress'))
      return
    }

    return await printService.connectPrinter({ mainboardId: printer.id, mainboardIP: printer.ip })
      .then((res) => {
        if (!res.success) {
          throw res
        }
        // Connect succeeds: the backend SSE stream does not push a status-update
        // at connect time, so seed status/job from the /connect response here
        // (same shape and mapping rules as SSE). Later SSE pushes still override.
        printer.allowJobNameFromStatus = true
        printer.job = {
          name: '',
          status: '',
          liveStatus: '',
          progress: 0,
          error: '',
          currentLayer: 0,
          totalLayer: 0,
        }
        _addUnique(printer, historyPrinters, 'id')
        if (res.data)
          _onStatus(res.data)
        useToast().success(t('common.messages.printerConnected'))
        _ensureMachineSubscribed(printer)
        return true
      })
      .catch((err) => {
        logger.error(err)
        showPrinterErrorToast('errors.printer.connectFailed')
        // Connection failed: offline is the only status we set ourselves.
        printer.status = printerStatus.disconnected
        printer.error = getPrintActionErrorDetails(err)
        return false
      })
  }

  async function connectPrinterByIP(ip) {
    const res = await printService.resolvePrinter({ mainboardIP: ip })
    if (!res.success) {
      if (res.code === 'PRINTER_NOT_FOUND') {
        useToast().errorKey('errors.printer.notFound')
      }
      else {
        showPrinterErrorToast('errors.printer.resolveFailed')
      }
      throw res
    }
    const { mainboardIP, mainboardID, name, model, firmware } = res.data
    const existing
      = getPrinter(mainboardIP)
      || nearbyPrinters.find(p => p.id === mainboardID)
      || historyPrinters.find(p => p.id === mainboardID)
    const target = existing ?? {
      id: mainboardID,
      ip: mainboardIP,
      name: name || mainboardIP,
      model: model || '',
      firmware: firmware || '',
      brand: '',
      port: 3030,
      status: printerStatus.disconnected,
      job: null,
      error: null,
      progress: 0,
      allowJobNameFromStatus: true,
    }
    if (!existing)
      _addUnique(target, nearbyPrinters, 'id')
    const success = await connectPrinter(target)
    if (!success)
      throw new Error('connect_failed')
  }

  async function uploadFile(fileItem, printer, uploadMetadata = {}) {
    if (!printer) {
      const error = t('common.messages.selectAPrinter')
      useToast().error(error)
      throw new Error(error)
    }
    if (printer.status === printerStatus.disconnected) {
      await connectPrinter(printer)
      // connectPrinter no longer sets status itself; wait for the SSE stream
      // to report idle before continuing.
      const becameIdle = await _waitForStatus(printer, printerStatus.idle)
      if (!becameIdle) {
        const error = t('common.messages.connectPrinterFailed')
        throw new Error(error)
      }
    }
    if (printer.status !== printerStatus.idle) {
      const error = t('common.messages.printerBusy')
      useToast().error(error)
      throw new Error(error)
    }

    fileItem.status = 'uploading'
    fileItem.progress = 0

    try {
      const machineSlug = uploadMetadata.machineSlug ?? null
      const resinName = typeof uploadMetadata.resinName === 'string'
        ? uploadMetadata.resinName.trim()
        : (uploadMetadata.resinName ?? null)
      const dentalMode = uploadMetadata.dentalMode ?? null
      const slicingParams = uploadMetadata.slicingParams ?? {}

      const res = await printService.uploadFile({
        file: fileItem.file,
        mainboardId: printer.id,
        printerId: printer.id,
        mainboardIP: printer.ip,
        machineSlug,
        resinName,
        dentalMode,
        filename: fileItem?.file?.name || fileItem.name || '',
        slicingParams,
      })
      if (!res.success) {
        throw res
      }
      const payload = res.data || {}
      const recordId = normalizeRecordId(payload.record_id)
      useToast().success(t('common.messages.fileUploaded'))
      fileItem.status = 'uploaded'
      fileItem.progress = 100
      fileItem.currentLayer = 0
      fileItem.totalLayer = 0
      fileItem.recordId = recordId
      fileItem.record_id = recordId
      const uploadedName = fileItem?.file?.name || fileItem.name || ''
      printer.job = {
        ...fileItem,
        name: uploadedName,
        recordId,
        record_id: recordId,
        status: normalizeStatus(payload.status || 'uploaded'),
        liveStatus: '',
      }
      printer.allowJobNameFromStatus = false
      return res
    }
    catch (err) {
      logger.error(err)
      fileItem.status = 'error'
      fileItem.error = getPrintActionErrorDetails(err)
      const uploadDetailKey = getErrorI18nKey(err?.code) || 'errors.printer.fileUploadFailed'
      showPrinterErrorToast(uploadDetailKey)
      throw err
    }
  }

  async function startPrinting(printer) {
    const { id, job } = printer
    if (!job) {
      const error = t('common.messages.noFileToPrint')
      useToast().error(error)
      throw new Error(error)
    }
    const recordId = _getJobRecordId(printer)
    if (!recordId) {
      const error = t('common.messages.noFileToPrint')
      useToast().error(error)
      throw new Error(error)
    }
    const previousJobStatus = normalizeStatus(printer.job?.status)
    // printer.status is driven by the backend SSE stream; do not set it here.
    printer.job.error = null

    try {
      const result = await printService.startPrinting({
        printerId: id,
        mainboardId: id,
        recordId,
      })

      if (!result.success) {
        throw result
      }

      if (printer.job) {
        const responseStatus = normalizeStatus(result?.data?.status)
        if (responseStatus)
          printer.job.status = responseStatus
      }
      useToast().success(t('common.messages.printStarted'))
    }
    catch (error) {
      logger.error(error)
      printer.job.status = previousJobStatus
      printer.job.error = getPrintActionErrorDetails(error)
      showPrinterErrorToast(getStartPrintErrorDetailKey(error))
      throw error
    }
  }

  async function pausePrinting(printer) {
    const { ip, id } = printer

    try {
      const result = await printService.pausePrinting({ mainboardId: id, mainboardIP: ip })

      if (!result.success) {
        throw result
      }
      useToast().success(t('common.messages.printPaused'))
    }
    catch (error) {
      logger.error(error)
      // printer.status is driven by the backend SSE stream; do not set it here.
      if (printer.job) {
        printer.job.error = getPrintActionErrorDetails(error)
      }
      showPrinterErrorToast(getErrorI18nKey(error?.code) || 'errors.printer.pauseFailed')
      // throw error
    }
  }

  async function resumePrinting(printer) {
    const { ip, id } = printer
    if (printer.status !== printerStatus.paused) {
      const error = t('common.messages.printerNotPaused')
      useToast().error(error)
      throw new Error(error)
    }

    try {
      const result = await printService.resumePrinting({ mainboardId: id, mainboardIP: ip })

      if (!result.success) {
        throw result
      }

      useToast().success(t('common.messages.printResumed'))
    }
    catch (error) {
      logger.error(error)
      // printer.status is driven by the backend SSE stream; do not set it here.
      if (printer.job) {
        printer.job.error = getPrintActionErrorDetails(error)
      }
      showPrinterErrorToast(getErrorI18nKey(error?.code) || 'errors.printer.resumeFailed')
      // throw error
    }
  }

  async function stopPrinting(printer) {
    const { ip, id } = printer
    const recordId = _getJobRecordId(printer)
    if (!recordId) {
      const error = t('common.messages.noFileToPrint')
      useToast().error(error)
      throw new Error(error)
    }

    try {
      const result = await printService.stopPrinting({
        printerId: id,
        mainboardId: id,
        mainboardIP: ip,
        recordId,
      })

      if (!result.success) {
        throw result
      }

      // job.status reflects the backend-2 response, not a hardcoded value.
      // Use the stop request's data.status; keep the previous value if absent.
      if (printer.job && result.data?.status != null)
        printer.job.status = result.data.status

      // printer.status is driven by the backend SSE stream; do not set it here.
      useToast().success(t('common.messages.printStopped'))
    }
    catch (error) {
      logger.error(error)
      // printer.status is driven by the backend SSE stream; do not set it here.
      if (printer.job) {
        printer.job.error = getPrintActionErrorDetails(error)
      }
      showPrinterErrorToast(getErrorI18nKey(error?.code) || 'errors.printer.stopFailed')
      // throw error
    }
  }

  return {
    nearbyPrinters,
    historyPrinters,
    isSearching,
    printerStatus,
    getNearbyPrinters,
    connectPrinter,
    connectPrinterByIP,
    uploadFile,
    getPrinter,
    startPrinting,
    pausePrinting,
    resumePrinting,
    stopPrinting,
  }
})
