import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkHealth = vi.hoisted(() => vi.fn())
const serverStatus = vi.hoisted(() => ({ checking: false }))

vi.mock('@/stores/useBackendStore', () => ({
  useBackendStore: () => ({
    checkHealth,
    serverStatus,
  }),
}))

async function loadHelper() {
  const mod = await import('@/axios/axios.js')
  return mod.maybeNotifySlicerDown
}

function flush() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

describe('maybeNotifySlicerDown', () => {
  beforeEach(() => {
    checkHealth.mockReset()
    checkHealth.mockResolvedValue(true)
    serverStatus.checking = false
  })

  describe('triggers checkHealth on connection-layer failures', () => {
    it('triggers when error.response is absent (network error)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({})
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers when error.code is ECONNABORTED', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ code: 'ECONNABORTED', response: { status: 0 } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers when error.code is ETIMEDOUT', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ code: 'ETIMEDOUT', response: { status: 0 } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers when error.code is ERR_NETWORK', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ code: 'ERR_NETWORK', response: { status: 0 } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it.each([500, 502, 503, 504])('triggers on status %i without backend code', async (status) => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ response: { status } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers on status 500 with empty string body (Vite dev proxy)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ response: { status: 500, data: '' } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers on status 500 with object body lacking code', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ response: { status: 500, data: {} } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })

    it('triggers on status 500 with empty Blob body', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ response: { status: 500, data: new Blob([]) } })
      await flush()
      expect(checkHealth).toHaveBeenCalledTimes(1)
    })
  })

  describe('does NOT trigger checkHealth on business errors', () => {
    it.each([400, 404, 422])('does not trigger on 4xx status %i', async (status) => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ response: { status } })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })

    it('does not trigger on BackendError-shaped response (4xx with code)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({
        response: { status: 400, data: { success: false, code: 'INVALID_CONFIG' } },
      })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })

    it('does not trigger on 500 with structured backend code (server alive, internal error)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({
        response: { status: 500, data: { success: false, code: 'INTERNAL_ERROR' } },
      })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })
  })

  describe('does NOT trigger when the failing request IS the health probe', () => {
    it('skips when error.config.url ends with /api/health (network error)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({ config: { url: '/api/health' } })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })

    it('skips when error.config.url ends with /api/health (500 empty body)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({
        config: { url: '/api/health' },
        response: { status: 500, data: '' },
      })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })

    it('skips when error.config.url is a full URL ending with /api/health', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      maybeNotifySlicerDown({
        config: { url: 'http://127.0.0.1:5179/api/health' },
        code: 'ECONNABORTED',
      })
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })
  })

  describe('debounce', () => {
    it('skips when serverStatus.checking is true', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      serverStatus.checking = true
      maybeNotifySlicerDown({})
      await flush()
      expect(checkHealth).not.toHaveBeenCalled()
    })

    it('only fires once when called multiple times in quick succession (checking flips true)', async () => {
      const maybeNotifySlicerDown = await loadHelper()
      // simulate checkHealth as a long-running promise that flips `checking`
      let resolveCheck
      checkHealth.mockImplementation(() => {
        serverStatus.checking = true
        return new Promise((res) => {
          resolveCheck = () => {
            serverStatus.checking = false
            res(true)
          }
        })
      })

      maybeNotifySlicerDown({})
      maybeNotifySlicerDown({})
      maybeNotifySlicerDown({})
      await flush()
      await flush()

      expect(checkHealth).toHaveBeenCalledTimes(1)
      resolveCheck()
    })
  })
})
