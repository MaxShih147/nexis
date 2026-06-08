import {
  getPasswordChecklist,
  isPasswordValid,
  validateEmail,
  validateEmailOnly,
  validateLoginValues,
  validateName,
  validateRegisterValues,
} from '@/utils/authValidation'
import { describe, expect, it } from 'vitest'

describe('validateEmail', () => {
  it('accepts standard addresses', () => {
    expect(validateEmail('ada@example.com')).toBe(true)
    expect(validateEmail('  ada@example.com  ')).toBe(true)
  })

  it('rejects malformed addresses', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('ada')).toBe(false)
    expect(validateEmail('ada@example')).toBe(false)
    expect(validateEmail('ada example.com')).toBe(false)
    expect(validateEmail(null)).toBe(false)
  })
})

describe('validateName', () => {
  it('accepts unicode letters and spaces', () => {
    expect(validateName('Ada')).toBe(true)
    expect(validateName('王 小明')).toBe(true)
    expect(validateName('María')).toBe(true)
  })

  it('rejects symbols, digits, and punctuation', () => {
    expect(validateName('Ada!')).toBe(false)
    expect(validateName('Ada1')).toBe(false)
    expect(validateName('O\'Brien')).toBe(false)
    expect(validateName('Ada-Lovelace')).toBe(false)
    expect(validateName('')).toBe(false)
  })
})

describe('getPasswordChecklist', () => {
  it('returns true for each rule a password satisfies', () => {
    expect(getPasswordChecklist('Aa1!aaaa')).toEqual({
      minLength: true,
      hasUppercase: true,
      hasLowercase: true,
      hasNumber: true,
      hasSpecial: true,
      noInvalidChars: true,
    })
  })

  it('flags missing rules', () => {
    expect(getPasswordChecklist('weak')).toEqual({
      minLength: false,
      hasUppercase: false,
      hasLowercase: true,
      hasNumber: false,
      hasSpecial: false,
      noInvalidChars: true,
    })
  })

  it('treats null and undefined as empty input', () => {
    const empty = {
      minLength: false,
      hasUppercase: false,
      hasLowercase: false,
      hasNumber: false,
      hasSpecial: false,
      noInvalidChars: true,
    }
    expect(getPasswordChecklist(null)).toEqual(empty)
    expect(getPasswordChecklist(undefined)).toEqual(empty)
  })

  it('hasSpecial only accepts the 7 allowed special characters', () => {
    expect(getPasswordChecklist('Aa1@aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1$aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1!aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1%aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1*aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1?aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1&aaaa').hasSpecial).toBe(true)
    expect(getPasswordChecklist('Aa1#aaaa').hasSpecial).toBe(false)
    expect(getPasswordChecklist('Aa1-aaaa').hasSpecial).toBe(false)
    expect(getPasswordChecklist('Aa1_aaaa').hasSpecial).toBe(false)
  })

  it('noInvalidChars rejects disallowed symbols', () => {
    expect(getPasswordChecklist('Aa1@aaaa').noInvalidChars).toBe(true)
    expect(getPasswordChecklist('Aa1#aaaa').noInvalidChars).toBe(false)
    expect(getPasswordChecklist('Aa1-aaaa').noInvalidChars).toBe(false)
    expect(getPasswordChecklist('Aa1_aaaa').noInvalidChars).toBe(false)
    expect(getPasswordChecklist('Aa1.aaaa').noInvalidChars).toBe(false)
    expect(getPasswordChecklist('Aa1,aaaa').noInvalidChars).toBe(false)
    expect(getPasswordChecklist('Aa1^aaaa').noInvalidChars).toBe(false)
  })
})

describe('isPasswordValid', () => {
  it('requires every checklist item', () => {
    expect(isPasswordValid('Aa1!aaaa')).toBe(true)
    expect(isPasswordValid('Aa1aaaaa')).toBe(false)
    expect(isPasswordValid('Short1!')).toBe(false)
  })

  it('rejects passwords with disallowed symbols even if other rules pass', () => {
    expect(isPasswordValid('Aa1#aaaa')).toBe(false)
    expect(isPasswordValid('Aa1-aaaa')).toBe(false)
    expect(isPasswordValid('Aa1_aaaa')).toBe(false)
  })
})

describe('validateLoginValues', () => {
  it('flags missing or invalid email and missing password', () => {
    expect(validateLoginValues({ email: '', password: '' })).toEqual({
      email: 'validation.auth.emailRequired',
      password: 'validation.auth.passwordRequired',
    })
    expect(validateLoginValues({ email: 'nope', password: 'x' })).toEqual({
      email: 'validation.auth.emailInvalid',
    })
  })

  it('returns no errors when both fields are present and email is valid', () => {
    expect(validateLoginValues({ email: 'ada@example.com', password: 'anything' })).toEqual({})
  })
})

describe('validateRegisterValues', () => {
  const valid = {
    email: 'ada@example.com',
    password: 'Aa1!aaaa',
    firstName: 'Ada',
    lastName: 'Lovelace',
  }

  it('returns no errors for a fully valid form', () => {
    expect(validateRegisterValues(valid)).toEqual({})
  })

  it('flags name fields with symbols', () => {
    const errors = validateRegisterValues({ ...valid, firstName: 'Ada!', lastName: 'Lovelace1' })
    expect(errors.firstName).toBe('validation.auth.firstNameInvalid')
    expect(errors.lastName).toBe('validation.auth.lastNameInvalid')
  })

  it('flags weak passwords without overriding required', () => {
    expect(validateRegisterValues({ ...valid, password: 'weak' }).password).toBe('validation.auth.passwordWeak')
    expect(validateRegisterValues({ ...valid, password: '' }).password).toBe('validation.auth.passwordRequired')
    expect(validateRegisterValues({ ...valid, password: 'Aa1#aaaa' }).password).toBe('validation.auth.passwordWeak')
  })

  it('flags missing names', () => {
    const errors = validateRegisterValues({ ...valid, firstName: '', lastName: '' })
    expect(errors.firstName).toBe('validation.auth.firstNameRequired')
    expect(errors.lastName).toBe('validation.auth.lastNameRequired')
  })
})

describe('validateEmailOnly', () => {
  it('flags missing and invalid email', () => {
    expect(validateEmailOnly({ email: '' })).toEqual({ email: 'validation.auth.emailRequired' })
    expect(validateEmailOnly({ email: 'nope' })).toEqual({ email: 'validation.auth.emailInvalid' })
  })

  it('passes a well-formed email', () => {
    expect(validateEmailOnly({ email: 'ada@example.com' })).toEqual({})
  })
})
