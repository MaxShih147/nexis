import { useToast } from '@/composables/useToast'
import { reactive, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'

export function useAuthForm(initialValues, validate) {
  const { t } = useI18n()
  const toast = useToast()
  const values = reactive({ ...initialValues })
  const errors = reactive({})
  const submitting = shallowRef(false)

  function setFieldError(field, errorKey = '') {
    if (!errorKey) {
      delete errors[field]
      return
    }

    errors[field] = errorKey
  }

  function validateForm() {
    const nextErrors = validate(values)

    Object.keys(errors).forEach((key) => {
      if (!nextErrors[key])
        delete errors[key]
    })

    Object.entries(nextErrors).forEach(([field, errorKey]) => {
      setFieldError(field, errorKey)
    })

    return Object.keys(nextErrors).length === 0
  }

  function validateField(field) {
    const nextErrors = validate(values)

    if (!nextErrors[field]) {
      delete errors[field]
      return true
    }

    setFieldError(field, nextErrors[field])
    return false
  }

  function notifyBlocked() {
    toast.error(
      t('errors.auth.invalidForm'),
      t('validation.auth.fixErrorsBeforeSubmit'),
    )
  }

  async function submit(handler) {
    if (!validateForm()) {
      notifyBlocked()
      return false
    }

    submitting.value = true

    try {
      await handler(values)
      return true
    }
    finally {
      submitting.value = false
    }
  }

  return {
    errors,
    submitting,
    submit,
    setFieldError,
    validateField,
    validateForm,
    values,
  }
}
