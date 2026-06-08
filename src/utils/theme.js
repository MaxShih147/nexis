export function getThreeThemeColors(isDarkMode) {
  return isDarkMode
    ? {
        backgroundColor: 0x2D2E32,
        textColor: 0xFFFFFF,
      }
    : {
        backgroundColor: 0xE7E5E4,
        textColor: 0x000000,
      }
}

export function applyThreeTheme(three, isDarkMode) {
  if (!three)
    return

  const { backgroundColor, textColor } = getThreeThemeColors(isDarkMode)

  three.setSceneColor?.(backgroundColor)
  three.customizeAxisHelper?.({
    faceColor: backgroundColor,
    labelColor: textColor,
    hoverColor: backgroundColor,
    hoverLabelColor: textColor,
    backgroundColor,
  })
}
