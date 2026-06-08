import i18n from '@/i18n'
import ToastEventBus from 'primevue/toasteventbus'

function t(key, params) {
  return i18n.global.t(key, params)
}

function emitToast(severity, summary, detail = '', life = 3000) {
  ToastEventBus.emit('add', { severity, summary, detail, life })
}

function emitKeyToast(severity, summaryKey, options = {}) {
  const {
    summaryParams,
    detailKey = '',
    detailParams,
    life = 3000,
  } = options

  emitToast(
    severity,
    t(summaryKey, summaryParams),
    detailKey ? t(detailKey, detailParams) : '',
    life,
  )
}

export function useToast() {
  const info = (summary, detail = '', life = 3000) => {
    emitToast('info', summary, detail, life)
  }
  const warn = (summary, detail = '', life = 3000) => {
    emitToast('warn', summary, detail, life)
  }

  const success = (summary, detail = '', life = 3000) => {
    emitToast('success', summary, detail, life)
  }

  const error = (summary, detail = '', life = 3000) => {
    emitToast('error', summary, detail, life)
  }

  const infoKey = (summaryKey, options = {}) => emitKeyToast('info', summaryKey, options)
  const warnKey = (summaryKey, options = {}) => emitKeyToast('warn', summaryKey, options)
  const successKey = (summaryKey, options = {}) => emitKeyToast('success', summaryKey, options)
  const errorKey = (summaryKey, options = {}) => emitKeyToast('error', summaryKey, options)

  return { info, warn, success, error, infoKey, warnKey, successKey, errorKey }
}
