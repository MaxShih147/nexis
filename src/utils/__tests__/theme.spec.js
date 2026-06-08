import { applyThreeTheme, getThreeThemeColors } from '@/utils/theme'
import { describe, expect, it, vi } from 'vitest'

describe('theme utils', () => {
  it('returns the expected dark theme colors for the 3D scene', () => {
    expect(getThreeThemeColors(true)).toEqual({
      backgroundColor: 0x2D2E32,
      textColor: 0xFFFFFF,
    })
  })

  it('returns the expected light theme colors for the 3D scene', () => {
    expect(getThreeThemeColors(false)).toEqual({
      backgroundColor: 0xE7E5E4,
      textColor: 0x000000,
    })
  })

  it('applies light theme colors to the 3D scene adapter', () => {
    const setSceneColor = vi.fn()
    const customizeAxisHelper = vi.fn()

    applyThreeTheme({ setSceneColor, customizeAxisHelper }, false)

    expect(setSceneColor).toHaveBeenCalledWith(0xE7E5E4)
    expect(customizeAxisHelper).toHaveBeenCalledWith({
      faceColor: 0xE7E5E4,
      labelColor: 0x000000,
      hoverColor: 0xE7E5E4,
      hoverLabelColor: 0x000000,
      backgroundColor: 0xE7E5E4,
    })
  })

  it('applies dark theme colors to the 3D scene adapter', () => {
    const setSceneColor = vi.fn()
    const customizeAxisHelper = vi.fn()

    applyThreeTheme({ setSceneColor, customizeAxisHelper }, true)

    expect(setSceneColor).toHaveBeenCalledWith(0x2D2E32)
    expect(customizeAxisHelper).toHaveBeenCalledWith({
      faceColor: 0x2D2E32,
      labelColor: 0xFFFFFF,
      hoverColor: 0x2D2E32,
      hoverLabelColor: 0xFFFFFF,
      backgroundColor: 0x2D2E32,
    })
  })
})
