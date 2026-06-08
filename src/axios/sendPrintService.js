import { logger } from '@/utils/logger'
import { db, udp } from './axios.js'

function createPrintServiceErrorPayload(error, fallbackCode) {
  return {
    success: false,
    code: error.response?.data?.code || fallbackCode,
    details: error.response?.data?.message || error.message || '',
    httpStatus: error.response?.status ?? null,
  }
}

function unwrapEnvelope(response) {
  return response?.data?.data ?? response?.data ?? {}
}

function normalizeSdcpTaskId(sdcpTaskId) {
  if (sdcpTaskId === null || sdcpTaskId === undefined)
    return null
  if (typeof sdcpTaskId === 'string') {
    const trimmedTaskId = sdcpTaskId.trim()
    return trimmedTaskId === '' ? null : trimmedTaskId
  }
  return sdcpTaskId
}

/**
 * Print Service API Interface
 * Base URL: http://localhost:5180/api/v1/printers
 */
export const printService = {
  /**
   * Check backend service health
   * Base URL: http://localhost:5180/api/v1/health
   * @returns {Promise<import('axios').AxiosResponse>} Axios response on success
   */
  async getHealth() {
    // Keep short timeout for quick availability checks
    return await udp.get('/health', { timeout: 3000 })
  },

  /**
   * Discover available printers on the network
   * @returns {Promise<{success: boolean, data?: {printers: Array}, message?: string}>} Response containing discovered printers array on success, or error message on failure
   */
  async getNearbyPrinters() {
    try {
      const response = await udp.get('/discover')
      return response.data
    }
    catch (error) {
      logger.error('Error fetching printers:', error)
      return createPrintServiceErrorPayload(error, 'PRINTER_DISCOVERY_FAILED')
    }
  },

  /**
   * Resolve printer identity by IP via UDP unicast (does not open WebSocket)
   * @param {{ mainboardIP: string }} params
   * @returns {Promise<{success: boolean, code?: string, data?: {mainboardIP, mainboardID, name, model, firmware}}>}
   */
  async resolvePrinter({ mainboardIP }) {
    try {
      const response = await udp.post('/resolve', { mainboardIP })
      return response.data
    }
    catch (error) {
      logger.error('Error resolving printer:', error)
      return createPrintServiceErrorPayload(error, 'PRINTER_RESOLVE_FAILED')
    }
  },

  /**
   * Connect to a specific printer
   * @param {{ mainboardId: string, mainboardIP: string }} params - Connection parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Connection result with printer data on success, or error message if connection failed
   */
  async connectPrinter({ mainboardId, mainboardIP }) {
    try {
      const response = await udp.post(`/${mainboardId}/connect`, { mainboardIP, mainboardID: mainboardId })
      return response.data
    }
    catch (error) {
      logger.error('Error connecting to printer:', error)
      return createPrintServiceErrorPayload(error, 'PRINTER_CONNECT_FAILED')
    }
  },

  /**
   * Upload file to printer
   * @param {{ file: File, mainboardId: string, mainboardIP: string }} params - Upload parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Upload confirmation with success message, or error details if upload failed
   */
  async uploadFile({
    file,
    sliceFile,
    modelFile,
    mainboardId,
    printerId,
    mainboardIP,
    machineSlug,
    resinName,
    dentalMode,
    filename,
    slicingParams,
  }) {
    try {
      const targetPrinterId = printerId || mainboardId
      const targetSliceFile = sliceFile || file
      const formData = new FormData()
      const normalizedSlicingParams = slicingParams === undefined ? {} : slicingParams
      formData.append('slice_file', targetSliceFile)

      if (modelFile)
        formData.append('model_file', modelFile)

      formData.append('mainboardIP', mainboardIP)

      if (machineSlug)
        formData.append('machine_slug', machineSlug)
      if (resinName)
        formData.append('resin_name', resinName)
      if (dentalMode)
        formData.append('dental_mode', dentalMode)
      const uploadFilename = filename || targetSliceFile?.name
      if (uploadFilename)
        formData.append('filename', uploadFilename)
      formData.append(
        'slicing_params',
        typeof normalizedSlicingParams === 'string' ? normalizedSlicingParams : JSON.stringify(normalizedSlicingParams),
      )

      const response = await udp.post(`/${targetPrinterId}/files`, formData)
      return response.data
    }
    catch (error) {
      logger.error('Error uploading file:', error)
      return createPrintServiceErrorPayload(error, 'PRINTER_UPLOAD_FAILED')
    }
  },

  /**
   * Find a print record by SDCP task id via backend 3.
   * @param {{ sdcpTaskId: string | number }} params - Lookup parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>}
   */
  async findRecordByTaskId({ sdcpTaskId }) {
    try {
      const normalizedTaskId = normalizeSdcpTaskId(sdcpTaskId)
      if (normalizedTaskId === null) {
        return {
          success: true,
          data: null,
        }
      }

      const response = await db.get('/v1/user/print-records', {
        params: {
          sdcp_task_id: normalizedTaskId,
          page: 1,
          page_size: 1,
        },
      })
      const payload = unwrapEnvelope(response)
      const record = Array.isArray(payload?.items) ? (payload.items[0] || null) : null

      return {
        success: true,
        data: record,
      }
    }
    catch (error) {
      logger.error('Error finding print record by task id:', error)
      return createPrintServiceErrorPayload(error, 'PRINT_RECORD_LOOKUP_FAILED')
    }
  },

  /**
   * Start printing
   * @param {{ mainboardId: string, mainboardIP: string, filename: string, startLayer?: number }} params - Print configuration
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Print job initiation result with printer response data on success, or error message if print failed to start
   */
  async startPrinting({ mainboardId, printerId, recordId, record_id: recordIdSnake, mainboardIP, filename, startLayer = 0 }) {
    try {
      const targetPrinterId = printerId || mainboardId
      const targetRecordId = recordId ?? recordIdSnake
      const body = targetRecordId
        ? { record_id: targetRecordId }
        : {
            mainboardID: mainboardId,
            mainboardIP,
            filename,
            startLayer,
          }
      const response = await udp.post(`/${targetPrinterId}/print`, body)
      return response.data
    }
    catch (error) {
      logger.error('Error starting print:', error)
      return createPrintServiceErrorPayload(error, 'PRINT_START_FAILED')
    }
  },

  /**
   * Pause current print job
   * @param {{ mainboardId: string, mainboardIP: string }} params - Pause parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Pause result with printer response data on success, or error message if pause failed
   */
  async pausePrinting({ mainboardId, mainboardIP }) {
    try {
      const response = await udp.post(`/${mainboardId}/print/pause`, {
        mainboardID: mainboardId,
        mainboardIP,
      })
      return response.data
    }
    catch (error) {
      logger.error('Error pausing print:', error)
      return createPrintServiceErrorPayload(error, 'PRINT_PAUSE_FAILED')
    }
  },

  /**
   * Resume paused print job
   * @param {{ mainboardId: string, mainboardIP: string }} params - Resume parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Resume result with printer response data on success, or error message if resume failed
   */
  async resumePrinting({ mainboardId, mainboardIP }) {
    try {
      const response = await udp.post(`/${mainboardId}/print/resume`, {
        mainboardID: mainboardId,
        mainboardIP,
      })
      return response.data
    }
    catch (error) {
      logger.error('Error resuming print:', error)
      return createPrintServiceErrorPayload(error, 'PRINT_RESUME_FAILED')
    }
  },

  /**
   * Stop current print job
   * @param {{ mainboardId: string, mainboardIP: string }} params - Stop parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Stop result with printer response data on success, or error message if stop failed
   */
  async stopPrinting({ mainboardId, printerId, recordId, record_id: recordIdSnake, mainboardIP }) {
    try {
      const targetPrinterId = printerId || mainboardId
      const targetRecordId = recordId ?? recordIdSnake
      const body = targetRecordId
        ? { record_id: targetRecordId }
        : {
            mainboardID: mainboardId,
            mainboardIP,
          }
      const response = await udp.post(`/${targetPrinterId}/print/stop`, body)
      return response.data
    }
    catch (error) {
      logger.error('Error stopping print:', error)
      return createPrintServiceErrorPayload(error, 'PRINT_STOP_FAILED')
    }
  },

  /**
   * Queue timeout reconciliation for a printer.
   * @param {{ mainboardId: string, printerId?: string, mainboardIP: string }} params - Sync parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Queue result
   */
  async syncRecords({ mainboardId, printerId, mainboardIP }) {
    try {
      const targetPrinterId = printerId || mainboardId
      const response = await udp.post(`/${targetPrinterId}/records/sync`, {
        mainboardID: mainboardId,
        mainboardIP,
      })
      return response.data
    }
    catch (error) {
      logger.error('Error syncing print records:', error)
      return createPrintServiceErrorPayload(error, 'RECORD_SYNC_FAILED')
    }
  },

  /**
   * Get current printer status
   * Note: This API expects a GET with a JSON body as currently implemented.
   * @param {{ mainboardId: string, mainboardIP: string }} params - Status parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Status result with printer response data on success, or error message if status failed to get
   */
  async getPrinterStatus({ mainboardId, mainboardIP }) {
    try {
      const response = await udp.request({
        method: 'GET',
        url: `/${mainboardId}/status`,
        data: { mainboardIP, mainboardID: mainboardId },
      })
      return response.data
    }
    catch (error) {
      logger.error('Error getting printer status:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to get printer status',
      }
    }
  },

  /**
   * Subscribe to status updates via SSE (POST with text/event-stream)
   * @param {{machines: Array<{mainboardIP: string, mainboardID: string}>, onConnected?: Function, onStatusUpdate?: Function, onSubscriptionUpdated?: Function, onError?: Function}} params
   * @returns {{ close: () => void }} - Call close() to stop the stream, or error message if status failed to get
   */
  subscribeToStatus({ machines, onConnected, onStatusUpdate, onSubscriptionUpdated, onError } = {}) {
    const controller = new AbortController()
    const baseURL = (udp?.defaults?.baseURL || '').replace(/\/+$/, '')
    const url = `${baseURL}/status/subscribe`

    ;(async () => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ machines }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          throw new Error(`Failed to subscribe to status updates: ${response.status} ${response.statusText}`)
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder('utf-8')
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done)
            break
          buffer += decoder.decode(value, { stream: true })

          let sepIndex = buffer.indexOf('\n\n')
          while (sepIndex !== -1) {
            const rawEvent = buffer.slice(0, sepIndex).trim()
            buffer = buffer.slice(sepIndex + 2)

            const lines = rawEvent.split('\n')
            let eventName = 'message'
            let dataPayload = ''

            for (const line of lines) {
              if (line.startsWith('event:'))
                eventName = line.slice(6).trim()
              else if (line.startsWith('data:'))
                dataPayload += line.slice(5).trim()
            }

            if (dataPayload) {
              try {
                const parsed = JSON.parse(dataPayload)
                if (eventName === 'connected' && typeof onConnected === 'function')
                  onConnected(parsed)
                else if (eventName === 'status-update' && typeof onStatusUpdate === 'function')
                  onStatusUpdate(parsed)
                else if (eventName === 'subscription-updated' && typeof onSubscriptionUpdated === 'function')
                  onSubscriptionUpdated(parsed)
              }
              catch (parseErr) {
                if (typeof onError === 'function')
                  onError(parseErr)
              }
            }

            sepIndex = buffer.indexOf('\n\n')
          }
        }
      }
      catch (err) {
        if (typeof onError === 'function')
          onError(err)
      }
    })()

    return {
      close: () => controller.abort(),
    }
  },

  /**
   * Unsubscribe from status updates
   * @param {{ clientId: string }} params
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Unsubscribe result with success message, or error details if unsubscribe failed
   */
  async unsubscribeFromStatus({ clientId }) {
    try {
      const response = await udp.post('/status/unsubscribe', { clientId })
      return response.data
    }
    catch (error) {
      logger.error('Error unsubscribing from status updates:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to unsubscribe from status updates',
      }
    }
  },

  /**
   * Add machines to an existing SSE subscription
   * @param {{ clientId: string, machines: Array<{ mainboardIP: string, mainboardID?: string }> }} params
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} promise
   */
  async addMachinesToSubscription({ clientId, machines }) {
    try {
      const response = await udp.post('/status/machines/add', { clientId, machines })
      return response.data
    }
    catch (error) {
      logger.error('Error adding machines to subscription:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to add machines to subscription',
      }
    }
  },

  /**
   * Remove machines from an existing SSE subscription
   * @param {{ clientId: string, machines: Array<{ mainboardIP: string, mainboardID?: string }> }} params
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} promise
   */
  async removeMachinesFromSubscription({ clientId, machines }) {
    try {
      const response = await udp.post('/status/machines/remove', { clientId, machines })
      return response.data
    }
    catch (error) {
      logger.error('Error removing machines from subscription:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to remove machines from subscription',
      }
    }
  },

  /**
   * Upload multiple files to printer (batch upload)
   * @param {{ files: File[], mainboardId: string, mainboardIP: string }} params - Batch upload parameters
   * @returns {Promise<{success: boolean, data?: any, message?: string}>} - Batch upload confirmation with results, or error details if upload failed
   */
  async uploadFilesBatch({ files, mainboardId, mainboardIP }) {
    try {
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('mainboardIP', mainboardIP)
      const response = await udp.post(`/${mainboardId}/files/batch`, formData, {
        timeout: 300000, // 5 minutes timeout for batch upload
      })
      return response.data
    }
    catch (error) {
      logger.error('Error uploading files batch:', error)
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to upload files batch',
      }
    }
  },
}

// Export individual functions for convenience
export const {
  getHealth,
  getNearbyPrinters,
  resolvePrinter,
  connectPrinter,
  uploadFile,
  findRecordByTaskId,
  startPrinting,
  pausePrinting,
  resumePrinting,
  stopPrinting,
  syncRecords,
  getPrinterStatus,
  subscribeToStatus,
  unsubscribeFromStatus,
  addMachinesToSubscription,
  removeMachinesFromSubscription,
  uploadFilesBatch,
} = printService

// Default export
export default printService
