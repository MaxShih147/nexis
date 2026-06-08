import DashboardUploadSliced from '@/components/features/file_loading/DashboardUploadSliced.vue'
import PreviewUploadSliced from '@/components/features/file_loading/PreviewUploadSliced.vue'
import i18n from '@/i18n'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const sliceState = vi.hoisted(() => ({
  sliceJob: {
    uploadMetadataSnapshot: null,
    slicingParamsSnapshot: null,
  },
}))

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: vi.fn(), success: vi.fn() }),
}))
vi.mock('@/stores/printers.js', () => ({
  usePrintersStore: () => ({ getPrinter: vi.fn(), uploadFile: vi.fn() }),
}))
vi.mock('@/composables/useUdpServer', () => ({
  useUdpServer: () => ({ ensureUdpServer: vi.fn().mockResolvedValue(true) }),
}))
vi.mock('@/stores/slice', () => ({
  useSliceStore: () => sliceState,
}))

// Stub the presentational base so it just renders the #metadata slot, exposing
// the controller's reactive metadata object the same way the real base does.
const BaseStub = defineComponent({
  props: ['visible', 'controller'],
  setup(props, { slots }) {
    return () => h('div', slots.metadata?.({ metadata: props.controller.uploadMetadata }))
  },
})

// Stub the fields component so we can read which fields it was told to render.
const FieldsStub = defineComponent({
  props: ['machineSlug', 'dentalMode', 'resinName', 'fields'],
  emits: ['update:machineSlug', 'update:dentalMode', 'update:resinName'],
  setup() {
    return () => h('div')
  },
})

function mountWrapper(Component, props = {}) {
  return mount(Component, {
    props,
    global: {
      plugins: [i18n],
      stubs: { BaseSlicedUploadDialog: BaseStub, SlicedUploadMetadataFields: FieldsStub },
    },
  })
}

function fieldsOf(wrapper) {
  return wrapper.findComponent(FieldsStub).props('fields')
}

describe('previewUploadSliced', () => {
  beforeEach(() => {
    sliceState.sliceJob.uploadMetadataSnapshot = null
    sliceState.sliceJob.slicingParamsSnapshot = null
  })

  it('shows no fields when the slice snapshot fully prefills metadata', () => {
    sliceState.sliceJob.uploadMetadataSnapshot = {
      machineSlug: 'Sonic LS Plus',
      resinName: 'Resin A',
      dentalMode: 'Dental Model',
    }
    const wrapper = mountWrapper(PreviewUploadSliced, { visible: true })
    expect(fieldsOf(wrapper)).toEqual([])
    expect(wrapper.findComponent(BaseStub).props('controller').hasUploadMetadata).toBe(true)
  })

  it('shows only the missing field and keeps prefilled values in metadata', () => {
    sliceState.sliceJob.uploadMetadataSnapshot = {
      machineSlug: 'Sonic LS Plus',
      resinName: '',
      dentalMode: 'Dental Model',
    }
    const wrapper = mountWrapper(PreviewUploadSliced, { visible: true })
    expect(fieldsOf(wrapper)).toEqual(['resinName'])
    const meta = wrapper.findComponent(BaseStub).props('controller').uploadMetadata
    expect(meta.machineSlug).toBe('sonic_ls_plus')
    expect(meta.dentalMode).toBe('Dental Model')
  })

  it('maps a store machine name to its slug', () => {
    sliceState.sliceJob.uploadMetadataSnapshot = { machineSlug: 'Sonic LS Plus' }
    const wrapper = mountWrapper(PreviewUploadSliced, { visible: true })
    expect(wrapper.findComponent(BaseStub).props('controller').uploadMetadata.machineSlug)
      .toBe('sonic_ls_plus')
  })

  it('falls back to showing fields for unknown / invalid snapshot values', () => {
    sliceState.sliceJob.uploadMetadataSnapshot = {
      machineSlug: 'No Such Printer',
      resinName: '',
      dentalMode: 'Bogus Mode',
    }
    const wrapper = mountWrapper(PreviewUploadSliced, { visible: true })
    expect(fieldsOf(wrapper)).toEqual(['machineSlug', 'dentalMode', 'resinName'])
  })

  it('keeps a field visible after the user fills it (snapshot, not live)', async () => {
    sliceState.sliceJob.uploadMetadataSnapshot = {
      machineSlug: 'Sonic LS Plus',
      resinName: '',
      dentalMode: 'Dental Model',
    }
    const wrapper = mountWrapper(PreviewUploadSliced, { visible: true })
    expect(fieldsOf(wrapper)).toEqual(['resinName'])

    wrapper.findComponent(FieldsStub).vm.$emit('update:resinName', 'R')
    await wrapper.vm.$nextTick()

    expect(fieldsOf(wrapper)).toEqual(['resinName']) // still shown
    expect(wrapper.findComponent(BaseStub).props('controller').uploadMetadata.resinName).toBe('R')
  })
})

describe('dashboardUploadSliced', () => {
  it('never prefills from store and lets the fields component default to all three', () => {
    const wrapper = mountWrapper(DashboardUploadSliced, { visible: true })
    const meta = wrapper.findComponent(BaseStub).props('controller').uploadMetadata
    expect(meta.machineSlug).toBe('')
    expect(meta.dentalMode).toBe('')
    expect(meta.resinName).toBe('')
    // Dashboard passes no `fields` prop, so the field component shows all three.
    expect(fieldsOf(wrapper)).toBeUndefined()
  })
})
