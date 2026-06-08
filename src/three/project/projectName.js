export const DEFAULT_PROJECT_NAME = 'untitled'

export function normalizeProjectName(name) {
  if (typeof name !== 'string')
    return DEFAULT_PROJECT_NAME

  const normalized = name.trim()
  return normalized || DEFAULT_PROJECT_NAME
}

export function buildProjectExportFilename(name, options = {}) {
  const normalized = normalizeProjectName(name)
  if (normalized !== DEFAULT_PROJECT_NAME)
    return `${normalized}.3mf`

  const date = options.date instanceof Date ? options.date : new Date()
  const timestamp = formatTimestamp(date, options.timeZone)
  return `${DEFAULT_PROJECT_NAME}-${timestamp}.3mf`
}

function formatTimestamp(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(date)
  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )

  return `${values.year}${values.month}${values.day}${values.hour}${values.minute}${values.second}`
}
