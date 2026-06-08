import cnMessages from '@/i18n/locales/cn.json'
import enMessages from '@/i18n/locales/en.json'
import jpMessages from '@/i18n/locales/jp.json'
import twMessages from '@/i18n/locales/tw.json'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import SelectLocale from '../SelectLocale.vue'

// ── helpers ────────────────────────────────────────────────────────────────

function createTestI18n(locale = 'en') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: {
      en: enMessages,
      tw: twMessages,
      cn: cnMessages,
      jp: jpMessages,
    },
  })
}

/** Stub PrimeVue's Select – renders a native <select> so options are easy to trigger */
const SelectStub = defineComponent({
  name: 'Select',
  props: {
    modelValue: Object,
    options: Array,
    optionLabel: String,
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h(
        'select',
        { 'data-testid': 'locale-select' },
        (props.options ?? []).map(opt =>
          h('option', {
            key: opt.value,
            value: opt.value,
            selected: props.modelValue?.value === opt.value,
            onClick: () => emit('update:modelValue', opt),
          }, opt.label),
        ),
      )
  },
})

// Mock Trans so tests control locale state
vi.mock('@/i18n/translation', () => {
  const Trans = {
    currentLocale: 'en',
    switchLanguage: vi.fn(),
    guessDefaultLocale: vi.fn(() => 'en'),
  }
  return { default: Trans }
})

// ── Consumer component — uses t() and renders a translated label ───────────

const Consumer = defineComponent({
  name: 'Consumer',
  template: '<span data-testid="label">{{ t("common.actions.slice") }}</span>',
  setup() {
    const { t } = useI18n()
    return { t }
  },
})

// ── tests ──────────────────────────────────────────────────────────────────

describe('selectLocale — reactive locale switching', () => {
  let i18n
  let Trans

  beforeEach(async () => {
    Trans = (await import('@/i18n/translation')).default
    Trans.currentLocale = 'en'
    Trans.switchLanguage.mockClear()
    // Default: switching just updates currentLocale (no real i18n side effect)
    Trans.switchLanguage.mockImplementation(async (locale) => {
      Trans.currentLocale = locale
    })
    i18n = createTestI18n('en')
  })

  // ── 7.1-a: selecting a locale calls switchLanguage ────────────────────

  it('calls Trans.switchLanguage with the selected locale value', async () => {
    const wrapper = mount(SelectLocale, {
      global: {
        plugins: [i18n],
        stubs: { Select: SelectStub },
      },
    })

    const twOption = wrapper.findAll('option').find(o => o.element.value === 'tw')
    expect(twOption).toBeDefined()
    await twOption.trigger('click')
    await nextTick()

    expect(Trans.switchLanguage).toHaveBeenCalledWith('tw')
  })

  it('calls Trans.switchLanguage with "jp" when Japanese is selected', async () => {
    const wrapper = mount(SelectLocale, {
      global: {
        plugins: [i18n],
        stubs: { Select: SelectStub },
      },
    })

    await wrapper.findAll('option').find(o => o.element.value === 'jp').trigger('click')
    await nextTick()

    expect(Trans.switchLanguage).toHaveBeenCalledWith('jp')
  })

  // ── 7.1-b: i18n locale change causes consumer text to update ──────────
  // These tests bypass SelectLocale and directly set i18n.global.locale
  // to verify that components using t() react to locale changes (the core
  // requirement of task 7.1: "UI text updates immediately on language switch").

  it('consumer text updates to Traditional Chinese when locale is set to tw', async () => {
    const consumer = mount(Consumer, { global: { plugins: [i18n] } })

    expect(consumer.find('[data-testid="label"]').text()).toBe('Slice')

    i18n.global.locale.value = 'tw'
    await nextTick()

    // tw: B_SLICE = '開始切片'
    expect(consumer.find('[data-testid="label"]').text()).toBe('開始切片')
  })

  it('consumer text updates to Japanese when locale is set to jp', async () => {
    const consumer = mount(Consumer, { global: { plugins: [i18n] } })

    expect(consumer.find('[data-testid="label"]').text()).toBe('Slice')

    i18n.global.locale.value = 'jp'
    await nextTick()

    // jp: B_SLICE = 'スライス'
    expect(consumer.find('[data-testid="label"]').text()).toBe('スライス')
  })

  it('consumer text updates to Simplified Chinese when locale is set to cn', async () => {
    const consumer = mount(Consumer, { global: { plugins: [i18n] } })

    expect(consumer.find('[data-testid="label"]').text()).toBe('Slice')

    i18n.global.locale.value = 'cn'
    await nextTick()

    // cn: B_SLICE = '开始切层'
    expect(consumer.find('[data-testid="label"]').text()).toBe('开始切层')
  })

  it('consumer text reverts to English when locale switches back to en', async () => {
    const consumer = mount(Consumer, { global: { plugins: [i18n] } })

    i18n.global.locale.value = 'tw'
    await nextTick()
    expect(consumer.find('[data-testid="label"]').text()).toBe('開始切片')

    i18n.global.locale.value = 'en'
    await nextTick()
    expect(consumer.find('[data-testid="label"]').text()).toBe('Slice')
  })

  // ── 7.1-c: option list completeness ──────────────────────────────────

  it('shows EN, 繁中, 簡中 and 日文 options', () => {
    const wrapper = mount(SelectLocale, {
      global: {
        plugins: [i18n],
        stubs: { Select: SelectStub },
      },
    })

    const values = wrapper.findAll('option').map(o => o.element.value)
    expect(values).toContain('en')
    expect(values).toContain('tw')
    expect(values).toContain('cn')
    expect(values).toContain('jp')
    expect(values).toHaveLength(4)
  })

  // ── 7.1-d: initial selection reflects current locale ─────────────────

  it('initialises with the current locale pre-selected', async () => {
    Trans.currentLocale = 'cn'
    i18n = createTestI18n('cn')

    const wrapper = mount(SelectLocale, {
      global: {
        plugins: [i18n],
        stubs: { Select: SelectStub },
      },
    })

    const selected = wrapper.findAll('option').find(o => o.element.selected)
    expect(selected?.element.value).toBe('cn')
  })
})
