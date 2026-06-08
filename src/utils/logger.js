function readBooleanEnv(value) {
  if (typeof value === 'boolean')
    return value
  if (typeof value === 'string')
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
  return false
}

export function isDebugEnabled() {
  return readBooleanEnv(import.meta.env.VITE_DEBUG_LOGS) || Boolean(import.meta.env.DEV)
}

export const logger = {
  error: (...args) => {
    if (isDebugEnabled())
      console.error(...args)
  },
  warn: (...args) => {
    if (isDebugEnabled())
      console.warn(...args)
  },
  log: (...args) => {
    if (isDebugEnabled())
      // eslint-disable-next-line no-console
      console.log(...args)
  },
}
