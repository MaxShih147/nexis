import { describe, expect, it } from 'vitest'
import { buildProjectExportFilename, DEFAULT_PROJECT_NAME, normalizeProjectName } from '../projectName'

describe('projectName helpers', () => {
  it('normalizes empty names to the default project name', () => {
    expect(normalizeProjectName('')).toBe(DEFAULT_PROJECT_NAME)
    expect(normalizeProjectName('   ')).toBe(DEFAULT_PROJECT_NAME)
    expect(normalizeProjectName(null)).toBe(DEFAULT_PROJECT_NAME)
  })

  it('trims custom names', () => {
    expect(normalizeProjectName('  Case A  ')).toBe('Case A')
  })

  it('uses a timestamped filename for the default project name', () => {
    const filename = buildProjectExportFilename(DEFAULT_PROJECT_NAME, {
      date: new Date('2026-05-08T02:03:04Z'),
      timeZone: 'UTC',
    })

    expect(filename).toBe('untitled-20260508020304.3mf')
  })

  it('keeps custom project names when exporting', () => {
    expect(buildProjectExportFilename('Case A')).toBe('Case A.3mf')
  })
})
