const PASSWORD_RULES = Object.freeze({
  minLength: 8,
  hasUppercase: /[A-Z]/,
  hasLowercase: /[a-z]/,
  hasNumber: /\d/,
  hasSpecial: /[@$!%*?&]/,
  noInvalidChars: /^[A-Z0-9@$!%*?&]*$/i,
})

const EMAIL_PATTERN = /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/
const NAME_PATTERN = /^[\p{L}\p{M}\s]+$/u

export function validateEmail(email) {
  return EMAIL_PATTERN.test(String(email || '').trim())
}

export function validateName(value) {
  return NAME_PATTERN.test(String(value || '').trim())
}

export function getPasswordChecklist(password) {
  const value = String(password || '')

  return {
    minLength: value.length >= PASSWORD_RULES.minLength,
    hasUppercase: PASSWORD_RULES.hasUppercase.test(value),
    hasLowercase: PASSWORD_RULES.hasLowercase.test(value),
    hasNumber: PASSWORD_RULES.hasNumber.test(value),
    hasSpecial: PASSWORD_RULES.hasSpecial.test(value),
    noInvalidChars: PASSWORD_RULES.noInvalidChars.test(value),
  }
}

export function isPasswordValid(password) {
  return Object.values(getPasswordChecklist(password)).every(Boolean)
}

export function validateLoginValues(values) {
  const errors = {}
  const email = String(values.email || '').trim()
  const password = String(values.password || '').trim()

  if (!email)
    errors.email = 'validation.auth.emailRequired'
  else if (!validateEmail(email))
    errors.email = 'validation.auth.emailInvalid'

  if (!password)
    errors.password = 'validation.auth.passwordRequired'

  return errors
}

export function validateRegisterValues(values) {
  const errors = validateLoginValues(values)
  const firstName = String(values.firstName || '').trim()
  const lastName = String(values.lastName || '').trim()

  if (!firstName)
    errors.firstName = 'validation.auth.firstNameRequired'
  else if (!validateName(firstName))
    errors.firstName = 'validation.auth.firstNameInvalid'

  if (!lastName)
    errors.lastName = 'validation.auth.lastNameRequired'
  else if (!validateName(lastName))
    errors.lastName = 'validation.auth.lastNameInvalid'

  if (String(values.password || '') && !isPasswordValid(values.password))
    errors.password = 'validation.auth.passwordWeak'

  return errors
}

export function validateEmailOnly(values) {
  const errors = {}
  const email = String(values.email || '').trim()

  if (!email)
    errors.email = 'validation.auth.emailRequired'
  else if (!validateEmail(email))
    errors.email = 'validation.auth.emailInvalid'

  return errors
}
