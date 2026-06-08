import { describe, expect, it } from 'vitest'
import { displayAccountField, formatAccountFullName } from '../accountDisplay'

describe('formatAccountFullName', () => {
  it('puts first name before last name with a space', () => {
    expect(formatAccountFullName('Tim', 'Chen')).toBe('Tim Chen')
  })

  it('returns empty when both names are missing', () => {
    expect(formatAccountFullName('', '')).toBe('')
    expect(formatAccountFullName('  ', '  ')).toBe('')
  })

  it('returns the available part when only one name is set', () => {
    expect(formatAccountFullName('Tim', '')).toBe('Tim')
    expect(formatAccountFullName('', 'Chen')).toBe('Chen')
  })
})

describe('displayAccountField', () => {
  it('returns em dash for empty values', () => {
    expect(displayAccountField('')).toBe('—')
    expect(displayAccountField('   ')).toBe('—')
  })

  it('returns trimmed text when present', () => {
    expect(displayAccountField('  Tim Chen  ')).toBe('Tim Chen')
  })
})
