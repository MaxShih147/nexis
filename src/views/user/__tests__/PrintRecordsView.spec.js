import i18n from '@/i18n'
import PrintRecordsView from '@/views/user/PrintRecordsView.vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const mockListPrintRecords = vi.hoisted(() => vi.fn())
const mockGetPrintRecord = vi.hoisted(() => vi.fn())
const mockGetPrintRecordSliceFile = vi.hoisted(() => vi.fn())

const toastError = vi.fn()
const toastSuccess = vi.fn()

vi.mock('@/axios/userService', () => ({
  listPrintRecords: mockListPrintRecords,
  getPrintRecord: mockGetPrintRecord,
  getPrintRecordSliceFile: mockGetPrintRecordSliceFile,
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    error: toastError,
    success: toastSuccess,
    info: vi.fn(),
    warn: vi.fn(),
    errorKey: vi.fn(),
    successKey: vi.fn(),
    infoKey: vi.fn(),
    warnKey: vi.fn(),
  }),
}))

function sampleRecord(overrides = {}) {
  return {
    record_id: 'rec-1',
    mainboard_ip: '192.168.1.20',
    mainboard_id: 'mb-1',
    machine_slug: 'sonic_ls_plus',
    resin_name: 'Aqua-Gray 8K',
    dental_mode: 'Dental Model',
    filename: 'aligner.prz',
    status: 'success',
    file_archive_status: 'completed',
    uploaded_at: '2026-04-20T10:00:00Z',
    ...overrides,
  }
}

function mountView() {
  setActivePinia(createPinia())
  return mount(PrintRecordsView, {
    global: {
      plugins: [i18n],
    },
  })
}

describe('printRecordsView', () => {
  beforeEach(() => {
    mockListPrintRecords.mockReset()
    mockGetPrintRecord.mockReset()
    mockGetPrintRecordSliceFile.mockReset()
    toastError.mockReset()
    toastSuccess.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('fetches the first page on mount with the expected params', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(1)
    expect(mockListPrintRecords).toHaveBeenCalledWith({ page: 1, page_size: 20 })
    expect(wrapper.text()).toContain('Sonic LS Plus')
    expect(wrapper.text()).toContain('aligner.prz')
    expect(wrapper.text()).toContain('Aqua-Gray 8K')
  })

  it('shows an empty state when there are no records', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [], total: 0 })

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('No print records yet.')
  })

  it('fetches detail once when a row is expanded and caches it on re-open', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })
    mockGetPrintRecord.mockResolvedValue({
      record_id: 'rec-1',
      slicing_params: {
        print: { layerHeight: 0.05, exposure: 2.5 },
      },
    })

    const wrapper = mountView()
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    await rows[0].trigger('click')
    await flushPromises()

    expect(mockGetPrintRecord).toHaveBeenCalledTimes(1)
    expect(mockGetPrintRecord).toHaveBeenCalledWith('rec-1')
    expect(wrapper.text()).toContain('Layer Height')

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await nextTick()
    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    expect(mockGetPrintRecord).toHaveBeenCalledTimes(1)
  })

  it('triggers slice-file download when the filename is clicked', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })
    mockGetPrintRecordSliceFile.mockResolvedValue({ url: 'https://example.com/presigned/aligner.prz' })

    const clickSpy = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[title="Download slice file"]').trigger('click')
    await flushPromises()

    expect(mockGetPrintRecordSliceFile).toHaveBeenCalledWith('rec-1')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('surfaces an expired toast and skips navigation when slice file is expired', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })
    mockGetPrintRecordSliceFile.mockRejectedValue({
      response: { data: { code: 'FILE_EXPIRED' } },
    })

    const clickSpy = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[title="Download slice file"]').trigger('click')
    await flushPromises()

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError.mock.calls[0][0]).toContain('retention policy')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('disables the download button when the archive failed', async () => {
    mockListPrintRecords.mockResolvedValue({
      items: [sampleRecord({ file_archive_status: 'failed' })],
      total: 1,
    })

    const wrapper = mountView()
    await flushPromises()

    const downloadBtn = wrapper.find('button[title="Download slice file"]')
    expect(downloadBtn.attributes('disabled')).toBeDefined()
  })

  it('surfaces a file-missing toast on FILE_NOT_FOUND', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })
    mockGetPrintRecordSliceFile.mockRejectedValue({
      response: { data: { code: 'FILE_NOT_FOUND' } },
    })

    const clickSpy = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(clickSpy)

    const wrapper = mountView()
    await flushPromises()

    await wrapper.find('button[title="Download slice file"]').trigger('click')
    await flushPromises()

    expect(toastError).toHaveBeenCalledTimes(1)
    expect(toastError.mock.calls[0][0]).toContain('not available for download')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('resets page to 1 and refetches when a filter changes', async () => {
    mockListPrintRecords.mockResolvedValue({ items: Array.from({ length: 20 }, (_, i) => sampleRecord({ record_id: `rec-${i}` })), total: 45 })

    const wrapper = mountView()
    await flushPromises()

    const nextBtn = wrapper.findAll('button').find(b => b.text() === 'Next')
    await nextBtn.trigger('click')
    await flushPromises()
    expect(mockListPrintRecords).toHaveBeenLastCalledWith({ page: 2, page_size: 20 })

    mockListPrintRecords.mockClear()
    const statusSelect = wrapper.findAll('select').at(-1)
    await statusSelect.setValue('success')
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenLastCalledWith({ page: 1, page_size: 20, status: 'success' })
  })

  it('renders search-bar controls in order: machine, dental mode, resin, filename, status', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    const controls = wrapper.findAll('.grid select, .grid input')
    expect(controls).toHaveLength(5)
    expect(controls[0].element.tagName).toBe('SELECT')
    expect(controls[0].attributes('aria-label')).toBe('Machine')
    expect(controls[1].element.tagName).toBe('SELECT')
    expect(controls[1].attributes('aria-label')).toBe('Dental mode')
    expect(controls[2].element.tagName).toBe('INPUT')
    expect(controls[2].attributes('aria-label')).toBe('Resin')
    expect(controls[3].element.tagName).toBe('INPUT')
    expect(controls[3].attributes('aria-label')).toBe('File')
    expect(controls[4].element.tagName).toBe('SELECT')
    expect(controls[4].attributes('aria-label')).toBe('Status')
  })

  it('does not query or change the list while typing the filename before blur', async () => {
    mockListPrintRecords.mockResolvedValue({
      items: [
        sampleRecord({ record_id: 'rec-target', filename: '99147632_shell_occlusion_l (1)' }),
        sampleRecord({ record_id: 'rec-other', filename: 'alpha_model_005.ctb', status: 'failed' }),
      ],
      total: 2,
    })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const filenameInput = wrapper.findAll('input')[1]
    await filenameInput.setValue('992')

    expect(mockListPrintRecords).not.toHaveBeenCalled()
    expect(wrapper.findAll('tr[role="button"]')).toHaveLength(2)
  })

  it('applies the filename filter and queries the backend on blur', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const filenameInput = wrapper.findAll('input')[1]
    await filenameInput.setValue('  shell_occlusi  ')
    await filenameInput.trigger('blur')
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(1)
    expect(mockListPrintRecords).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      filename: 'shell_occlusi',
    })
  })

  it('applies the resin filter and queries the backend on blur', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const resinInput = wrapper.findAll('input')[0]
    await resinInput.setValue('Aqua')
    await resinInput.trigger('blur')
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(1)
    expect(mockListPrintRecords).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      resin_name: 'Aqua',
    })
  })

  it('applies the filter when Enter is pressed in the input', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const filenameInput = wrapper.findAll('input')[1]
    await filenameInput.setValue('aligner')
    await filenameInput.trigger('keydown.enter')
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(1)
    expect(mockListPrintRecords).toHaveBeenLastCalledWith({
      page: 1,
      page_size: 20,
      filename: 'aligner',
    })
  })

  it('does not re-query when blurring an input whose value did not change', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const resinInput = wrapper.findAll('input')[0]
    await resinInput.trigger('blur')
    await flushPromises()

    expect(mockListPrintRecords).not.toHaveBeenCalled()
  })

  it('queries immediately when the dental mode select changes', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })

    const wrapper = mountView()
    await flushPromises()

    mockListPrintRecords.mockClear()
    const dentalSelect = wrapper.findAll('select')[1]
    await dentalSelect.setValue(dentalSelect.findAll('option')[1].element.value)
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(1)
    expect(mockListPrintRecords.mock.calls[0][0]).toMatchObject({ page: 1, page_size: 20 })
    expect(mockListPrintRecords.mock.calls[0][0].dental_mode).toBeTruthy()
  })

  it('renders a load-error banner and retries on click', async () => {
    mockListPrintRecords.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountView()
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load print records.')

    mockListPrintRecords.mockResolvedValueOnce({ items: [sampleRecord()], total: 1 })
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()

    expect(mockListPrintRecords).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('aligner.prz')
  })

  it('shows a detail-error banner and retries detail fetch', async () => {
    mockListPrintRecords.mockResolvedValue({ items: [sampleRecord()], total: 1 })
    mockGetPrintRecord.mockRejectedValueOnce(new Error('boom'))

    const wrapper = mountView()
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to load record details.')

    mockGetPrintRecord.mockResolvedValueOnce({
      record_id: 'rec-1',
      slicing_params: { print: { layerHeight: 0.05 } },
    })
    const retryBtn = wrapper.findAll('button').find(b => b.text() === 'Retry')
    await retryBtn.trigger('click')
    await flushPromises()

    expect(mockGetPrintRecord).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('Layer Height')
  })
})
