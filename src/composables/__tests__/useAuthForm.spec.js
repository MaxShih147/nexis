import { useAuthForm } from '@/composables/useAuthForm'
import i18n from '@/i18n'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

const toastError = vi.fn()
vi.mock('@/composables/useToast', () => ({
  useToast: () => ({ error: toastError, success: vi.fn() }),
}))

function mountWithForm(initial, validate) {
  let api
  const wrapper = mount(defineComponent({
    setup() {
      api = useAuthForm(initial, validate)
      return () => h('div')
    },
  }), {
    global: { plugins: [i18n] },
  })
  return { wrapper, api }
}

describe('useAuthForm', () => {
  beforeEach(() => {
    toastError.mockReset()
  })

  it('exposes reactive values and starts with no errors', () => {
    const { api } = mountWithForm({ email: '', password: '' }, () => ({}))
    expect(api.values).toEqual({ email: '', password: '' })
    expect(api.errors).toEqual({})
    expect(api.submitting.value).toBe(false)
  })

  it('validateForm sets every error returned by the validator', () => {
    const validator = values => values.email ? {} : { email: 'validation.auth.emailRequired' }
    const { api } = mountWithForm({ email: '' }, validator)

    expect(api.validateForm()).toBe(false)
    expect(api.errors.email).toBe('validation.auth.emailRequired')

    api.values.email = 'ada@example.com'
    expect(api.validateForm()).toBe(true)
    expect(api.errors.email).toBeUndefined()
  })

  it('validateField updates only the specified field and reports its validity', () => {
    const validator = values => ({
      email: values.email ? null : 'validation.auth.emailRequired',
      password: values.password ? null : 'validation.auth.passwordRequired',
    })
    const validate = values => Object.fromEntries(
      Object.entries(validator(values)).filter(([, v]) => v),
    )
    const { api } = mountWithForm({ email: '', password: '' }, validate)

    expect(api.validateField('email')).toBe(false)
    expect(api.errors.email).toBe('validation.auth.emailRequired')
    expect(api.errors.password).toBeUndefined()

    api.values.email = 'ada@example.com'
    expect(api.validateField('email')).toBe(true)
    expect(api.errors.email).toBeUndefined()
  })

  it('setFieldError clears the entry when given an empty key', () => {
    const { api } = mountWithForm({ email: '' }, () => ({}))
    api.setFieldError('email', 'validation.auth.emailRequired')
    expect(api.errors.email).toBe('validation.auth.emailRequired')

    api.setFieldError('email', '')
    expect(api.errors.email).toBeUndefined()
  })

  it('submit() runs the handler when valid and toggles submitting around it', async () => {
    const { api } = mountWithForm({ email: 'ada@example.com' }, () => ({}))
    const handler = vi.fn(async () => {
      expect(api.submitting.value).toBe(true)
    })

    const ok = await api.submit(handler)

    expect(ok).toBe(true)
    expect(handler).toHaveBeenCalledWith(api.values)
    expect(api.submitting.value).toBe(false)
    expect(toastError).not.toHaveBeenCalled()
  })

  it('submit() blocks the handler and toasts when validation fails', async () => {
    const { api } = mountWithForm({ email: '' }, () => ({ email: 'validation.auth.emailRequired' }))
    const handler = vi.fn()

    const ok = await api.submit(handler)

    expect(ok).toBe(false)
    expect(handler).not.toHaveBeenCalled()
    expect(toastError).toHaveBeenCalledTimes(1)
  })

  it('submit() releases submitting even when the handler throws', async () => {
    const { api } = mountWithForm({ email: 'ada@example.com' }, () => ({}))
    const handler = vi.fn(async () => {
      throw new Error('boom')
    })

    await expect(api.submit(handler)).rejects.toThrow('boom')
    expect(api.submitting.value).toBe(false)
  })
})
