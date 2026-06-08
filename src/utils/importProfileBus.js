import { logger } from '@/utils/logger'

const listeners = new Set()

export function requestImportProfile() {
  const orderedListeners = Array.from(listeners).reverse()

  for (const listener of orderedListeners) {
    try {
      if (listener() === true)
        return true
    }
    catch (error) {
      logger.error('Failed to handle import profile request', error)
    }
  }

  return false
}

export function onImportProfileRequest(callback) {
  if (typeof callback !== 'function')
    return () => {}
  listeners.add(callback)
  return () => listeners.delete(callback)
}
