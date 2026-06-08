import {
  formatFileSize,
  missingMetadataFields,
  resolvePrefillMetadata,
  useSlicedUpload,
} from '@/composables/useSlicedUpload'
import i18n from '@/i18n'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const toastError = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn() }),
}))

const getPrinter = vi.fn()
const uploadFile = vi.fn()
vi.mock('@/stores/printers.js', () => ({
  usePrintersStore: () => ({ getPrinter, uploadFile }),
}))

vi.mock('@/composables/useUdpServer', () => ({
  useUdpServer: () => ({ ensureUdpServer: vi.fn().mockResolvedValue(true) }),
}))

function mountComposable(opts = {}) {
  let api
  const wrapper = mount(defineComponent({
    setup() {
      api = useSlicedUpload(opts)
      return () => h('div')
    },
  }), { global: { plugins: [i18n] } })
  return { wrapper, api }
}

describe('resolvePrefillMetadata', () => {
  it('maps a known machine name to its slug', () => {
    const result = resolvePrefillMetadata({ machineName: 'Sonic LS Plus' })
    expect(result.machineSlug).toBe('sonic_ls_plus')
  })

  it('keeps a value that is already a known slug', () => {
    const result = resolvePrefillMetadata({ machineName: 'sonic_ls_plus' })
    expect(result.machineSlug).toBe('sonic_ls_plus')
  })

  it('returns empty machineSlug for an unknown machine value', () => {
    expect(resolvePrefillMetadata({ machineName: 'No Such Printer' }).machineSlug).toBe('')
    expect(resolvePrefillMetadata({ machineName: '' }).machineSlug).toBe('')
    expect(resolvePrefillMetadata({}).machineSlug).toBe('')
  })

  it('keeps a valid dental mode and drops an invalid one', () => {
    expect(resolvePrefillMetadata({ dentalMode: 'Dental Model' }).dentalMode).toBe('Dental Model')
    expect(resolvePrefillMetadata({ dentalMode: 'Bogus Mode' }).dentalMode).toBe('')
  })

  it('normalizes legacy dental mode aliases', () => {
    expect(resolvePrefillMetadata({ dentalMode: 'Orthodontic Model' }).dentalMode).toBe('Dental Model')
  })

  it('trims resin name and treats blank as empty', () => {
    expect(resolvePrefillMetadata({ resinName: '  Resin A  ' }).resinName).toBe('Resin A')
    expect(resolvePrefillMetadata({ resinName: '   ' }).resinName).toBe('')
  })
})

describe('missingMetadataFields', () => {
  it('returns no fields when all are present', () => {
    expect(missingMetadataFields({
      machineSlug: 'sonic_ls_plus',
      dentalMode: 'Dental Model',
      resinName: 'Resin A',
    })).toEqual([])
  })

  it('returns only the empty fields', () => {
    expect(missingMetadataFields({
      machineSlug: 'sonic_ls_plus',
      dentalMode: 'Dental Model',
      resinName: '',
    })).toEqual(['resinName'])
  })

  it('treats whitespace-only resin as missing', () => {
    expect(missingMetadataFields({
      machineSlug: 'sonic_ls_plus',
      dentalMode: 'Dental Model',
      resinName: '   ',
    })).toEqual(['resinName'])
  })

  it('reports all fields missing for an empty metadata object', () => {
    expect(missingMetadataFields({})).toEqual(['machineSlug', 'dentalMode', 'resinName'])
  })
})

describe('formatFileSize', () => {
  it('formats bytes and larger units', () => {
    expect(formatFileSize(512)).toBe('512 bytes')
    expect(formatFileSize(2048)).toBe('2.00 KB')
  })
})

describe('useSlicedUpload', () => {
  beforeEach(() => {
    getPrinter.mockReset()
    uploadFile.mockReset()
    toastError.mockReset()
  })

  it('seedMetadata fills only valid resolved values', () => {
    const { api } = mountComposable()
    api.seedMetadata({
      machineName: 'Sonic LS Plus',
      dentalMode: 'Dental Model',
      resinName: 'Resin A',
    })
    expect(api.uploadMetadata.machineSlug).toBe('sonic_ls_plus')
    expect(api.uploadMetadata.dentalMode).toBe('Dental Model')
    expect(api.uploadMetadata.resinName).toBe('Resin A')
    expect(api.hasUploadMetadata).toBe(true)
  })

  it('seedMetadata leaves unknown values empty so they surface as missing fields', () => {
    const { api } = mountComposable()
    api.seedMetadata({ machineName: 'Sonic LS Plus', dentalMode: 'Bogus', resinName: '' })
    expect(api.hasUploadMetadata).toBe(false)
    expect(missingMetadataFields(api.uploadMetadata)).toEqual(['dentalMode', 'resinName'])
  })

  it('canSubmit requires a machine, files and complete metadata (not idle status)', async () => {
    const { api } = mountComposable()
    getPrinter.mockReturnValue({ status: 'printing' })

    expect(api.canSubmit).toBe(false)

    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])
    expect(api.canSubmit).toBe(false) // metadata still empty

    api.seedMetadata({ machineName: 'Sonic LS Plus', dentalMode: 'Dental Model', resinName: 'Resin A' })
    await Promise.resolve()
    // Enabled even though the machine is not idle — readiness is checked at submit.
    expect(api.canSubmit).toBe(true)
  })

  it('uploadFiles aborts with a toast when the printer is not idle', async () => {
    const { api } = mountComposable()
    getPrinter.mockReturnValue({ status: 'printing' })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])

    await api.uploadFiles(api.files)

    expect(toastError).toHaveBeenCalledWith(expect.stringContaining('printing'))
    expect(uploadFile).not.toHaveBeenCalled()
  })

  it('uploadFiles proceeds when the printer is idle', async () => {
    const { api } = mountComposable()
    getPrinter.mockReturnValue({ status: 'idle' })
    uploadFile.mockResolvedValue({ success: true })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])

    await api.uploadFiles(api.files)

    expect(uploadFile).toHaveBeenCalledTimes(1)
  })

  it('rejects unsupported file types', () => {
    const { api } = mountComposable()
    api.handleFileSelect([{ name: 'model.stl', size: 10, type: '' }])
    expect(api.files).toHaveLength(0)
    api.handleFileSelect([{ name: 'model.ctb', size: 10, type: '' }])
    expect(api.files).toHaveLength(1)
  })

  it('uploadFiles uses slicingParams: {} when no uploadContextProvider', async () => {
    const { api } = mountComposable()
    getPrinter.mockReturnValue({ status: 'idle' })
    uploadFile.mockResolvedValue({ success: true })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])
    api.seedMetadata({ machineName: 'Sonic LS Plus', dentalMode: 'Dental Model', resinName: 'Resin A' })

    await api.uploadFiles(api.files)

    expect(uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ slicingParams: {} }),
    )
  })

  it('uploadContextProvider overrides slicingParams and metadata', async () => {
    const snapshot = { machineSlug: 'sonic_cs_plus', resinName: 'Snapshot Resin', dentalMode: 'Surgical Guide', slicingParams: { print: { layerHeight: 0.1 } } }
    const { api } = mountComposable({
      uploadContextProvider: () => snapshot,
    })
    getPrinter.mockReturnValue({ status: 'idle' })
    uploadFile.mockResolvedValue({ success: true })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])

    await api.uploadFiles(api.files)

    expect(uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        machineSlug: 'sonic_cs_plus',
        resinName: 'Snapshot Resin',
        dentalMode: 'Surgical Guide',
        slicingParams: { print: { layerHeight: 0.1 } },
      }),
    )
  })

  it('uploadContextProvider with empty-string fields falls back to user-filled uploadMetadata', async () => {
    const { api } = mountComposable({
      uploadContextProvider: () => ({ machineSlug: null, resinName: null, dentalMode: null, slicingParams: { layers: 10 } }),
    })
    getPrinter.mockReturnValue({ status: 'idle' })
    uploadFile.mockResolvedValue({ success: true })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])
    api.seedMetadata({ machineName: 'Sonic LS Plus', dentalMode: 'Dental Model', resinName: 'User Resin' })

    await api.uploadFiles(api.files)

    expect(uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({
        machineSlug: expect.stringMatching(/.+/),
        resinName: 'User Resin',
        dentalMode: 'Dental Model',
        slicingParams: { layers: 10 },
      }),
    )
  })

  it('uploadContextProvider returning null slicingParams falls back to {}', async () => {
    const { api } = mountComposable({
      uploadContextProvider: () => ({ slicingParams: null }),
    })
    getPrinter.mockReturnValue({ status: 'idle' })
    uploadFile.mockResolvedValue({ success: true })
    api.selectedMachineIP = '192.168.0.2'
    api.handleFileSelect([{ name: 'model.prz', size: 10, type: '' }])

    await api.uploadFiles(api.files)

    expect(uploadFile).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ slicingParams: {} }),
    )
  })
})
