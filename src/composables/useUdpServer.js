import { getHealth } from '@/axios/sendPrintService.js'
import i18n from '@/i18n'
import { useDialog } from 'primevue/usedialog'
import { useToast } from './useToast'

/**
 * Composable to ensure the UDP server is reachable. If not, opens a dialog
 * prompting the user to start or download the UDP server.
 */
export function useUdpServer() {
  const dialog = useDialog()
  const toast = useToast()
  const t = (...args) => i18n.global.t(...args)

  /**
   * Pings the UDP service by calling a lightweight endpoint.
   * @returns {Promise<boolean>} true if reachable, false otherwise
   */
  async function pingUdp() {
    try {
      // Use centralized health check endpoint
      const res = await getHealth()
      // Consider any 2xx as available
      return !!res && res.status >= 200 && res.status < 300
    }
    catch {
      return false
    }
  }

  /**
   * Ensure the UDP server is available. If unreachable, opens a modal that allows
   * users to download the UDP server for their OS and retry once it is started.
   * @returns {Promise<boolean>} resolves true if reachable (immediately or after retry), false if user cancels
   */
  async function ensureUdpServer() {
    const ok = await pingUdp()
    if (ok)
      return true

    // Lazy import to keep bundle lean
    const UdpServerDialog = (await import('@/components/features/add_printers/UdpServerDialog.vue')).default

    return new Promise((resolve) => {
      const ref = dialog.open(UdpServerDialog, {
        props: { closable: true, modal: true },
        data: {},
        onClose: async (opt) => {
          if (opt?.data === 'retry') {
            // Retry once user claims they started the server
            const reachable = await pingUdp()
            if (!reachable)
              toast.error(t('common.messages.udpNotReachable'))
            resolve(reachable)
          }
          else {
            resolve(false)
          }
        },
      })

      // In case dialog fails to open for any reason, resolve false
      if (!ref)
        resolve(false)
    })
  }

  return { ensureUdpServer, pingUdp }
}
