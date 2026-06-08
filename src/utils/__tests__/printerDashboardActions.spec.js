import {
  hasPrintableRecordStatus,
  hasUploadedJob,
  normalizedPrinterStatus,
  pauseDisabled,
  printableRecordStatus,
  printAction,
  showPause,
  showPrint,
  showReconnect,
  showStop,
  showUpload,
  stopDisabled,
} from '@/utils/printerDashboardActions.js'
import { describe, expect, it } from 'vitest'

function printer(status, job = null) {
  return { status, job }
}

const uploadedJob = { recordId: 42 }
const uploadedRecord = { recordId: 42, status: 'uploaded' }
const timeoutRecord = { recordId: 42, status: 'timeout' }
const failedRecord = { recordId: 42, status: 'failed' }
const successRecord = { recordId: 42, status: 'success' }
const canceledRecord = { recordId: 42, status: 'canceled' }

describe('printerDashboardActions', () => {
  // Each row: [status, job, reconnect, print, pause, pauseDisabled, stop, stopDisabled, upload]
  const rows = [
    // status              job           recon  print  pause  pDis   stop   sDis   upload
    ['offline', null, true, false, false, true, false, false, false],
    ['idle', null, false, false, false, true, false, false, true],
    ['idle', uploadedRecord, false, true, false, true, false, false, true],
    ['idle', timeoutRecord, false, true, false, true, false, false, true],
    ['idle', failedRecord, false, false, false, true, false, false, true],
    ['idle', successRecord, false, false, false, true, false, false, true],
    ['idle', canceledRecord, false, false, false, true, false, false, true],
    ['Stopped', uploadedRecord, false, true, false, true, false, false, false],
    ['stopped', timeoutRecord, false, true, false, true, false, false, false],
    ['Stopped', failedRecord, false, true, false, true, false, false, false],
    ['homing', uploadedJob, false, false, true, false, true, false, false],
    ['file checking', uploadedJob, false, false, true, false, true, false, false],
    ['printing', uploadedJob, false, false, true, false, true, false, false],
    ['paused', uploadedJob, false, true, false, true, true, false, false],
    ['pausing', uploadedJob, false, false, true, true, true, false, false],
    ['stopping', uploadedJob, false, false, true, true, true, true, false],
    ['file transfer', uploadedJob, false, false, true, true, true, true, false],
    ['exposure test', uploadedJob, false, false, true, true, true, true, false],
    ['devices testing', uploadedJob, false, false, true, true, true, true, false],
  ]

  for (const [status, job, recon, print, pause, pDis, stop, sDis, upload] of rows) {
    it(`renders the correct buttons for status "${status}"${job ? ' (with job)' : ''}`, () => {
      const p = printer(status, job)
      expect(showReconnect(p)).toBe(recon)
      expect(showPrint(p)).toBe(print)
      expect(showPause(p)).toBe(pause)
      expect(pauseDisabled(p)).toBe(pDis)
      expect(showStop(p)).toBe(stop)
      expect(stopDisabled(p)).toBe(sDis)
      expect(showUpload(p)).toBe(upload)
    })
  }

  it('treats record_id (snake_case) as an uploaded job', () => {
    expect(hasUploadedJob(printer('idle', { record_id: 7 }))).toBe(true)
    expect(showUpload(printer('idle', { record_id: 7 }))).toBe(true)
    expect(showPrint(printer('idle', { record_id: 7 }))).toBe(false)
  })

  it('uses print record status to decide whether idle printers can show Print', () => {
    expect(hasPrintableRecordStatus(printer('idle', { status: 'uploaded' }))).toBe(true)
    expect(hasPrintableRecordStatus(printer('idle', { status: 'timeout' }))).toBe(true)
    expect(hasPrintableRecordStatus(printer('idle', { status: 'Stopped' }))).toBe(false)
    expect(hasPrintableRecordStatus(printer('idle', { status: 'failed' }))).toBe(false)
    expect(hasPrintableRecordStatus(printer('idle', { status: 'success' }))).toBe(false)
  })

  it('normalizes print record status before matching', () => {
    const p = printer('idle', { status: '  Uploaded ' })
    expect(printableRecordStatus(p)).toBe('uploaded')
    expect(showPrint(p)).toBe(true)
  })

  it('normalizes printer status before matching dashboard actions', () => {
    const p = printer('  Stopped ', { status: 'uploaded' })
    expect(normalizedPrinterStatus(p)).toBe('stopped')
    expect(showPrint(p)).toBe(true)
    expect(showUpload(p)).toBe(false)
  })

  it('treats an empty job (no recordId) as no uploaded job', () => {
    const emptyJob = { name: '', status: '' }
    expect(hasUploadedJob(printer('idle', emptyJob))).toBe(false)
    expect(showUpload(printer('idle', emptyJob))).toBe(true)
    expect(showPrint(printer('idle', emptyJob))).toBe(false)
  })

  describe('printAction', () => {
    it('resumes when paused', () => {
      expect(printAction(printer('paused', uploadedJob))).toBe('resumePrinting')
    })

    it('starts in any non-paused state', () => {
      expect(printAction(printer('idle', uploadedJob))).toBe('startPrinting')
      expect(printAction(printer('printing', uploadedJob))).toBe('startPrinting')
    })
  })
})
