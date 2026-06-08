import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const healthCheck = vi.hoisted(() => vi.fn())

vi.mock('@/axios/backendService', () => ({
  healthCheck,
}))

describe('slicer interceptor → useBackendStore integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    healthCheck.mockReset()
  })

  it('an ECONNABORTED on a slicer call transitions store to available=false, dialog=true', async () => {
    const rejection = new Error('timeout')
    rejection.code = 'ECONNABORTED'
    healthCheck.mockRejectedValue(rejection)

    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()
    // simulate having previously connected successfully
    store.serverStatus.available = true
    store.showServerDialog = false

    const { maybeNotifySlicerDown } = await import('@/axios/axios.js')
    maybeNotifySlicerDown({ code: 'ECONNABORTED' })

    // let the fire-and-forget checkHealth promise settle
    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(healthCheck).toHaveBeenCalledTimes(1)
    expect(store.serverStatus.available).toBe(false)
    expect(store.showServerDialog).toBe(true)
  })

  it('500 with structured backend code does NOT transition the store (server alive)', async () => {
    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()
    store.serverStatus.available = true
    store.showServerDialog = false

    const { maybeNotifySlicerDown } = await import('@/axios/axios.js')
    maybeNotifySlicerDown({ response: { status: 500, data: { success: false, code: 'INTERNAL' } } })

    await new Promise(r => setTimeout(r, 0))

    expect(healthCheck).not.toHaveBeenCalled()
    expect(store.serverStatus.available).toBe(true)
    expect(store.showServerDialog).toBe(false)
  })

  it('a Vite dev proxy 500 with empty body transitions the store to down + dialog', async () => {
    const rejection = new Error('proxy failure')
    healthCheck.mockRejectedValue(rejection)

    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()
    store.serverStatus.available = true
    store.showServerDialog = false

    const { maybeNotifySlicerDown } = await import('@/axios/axios.js')
    // Vite's http-proxy default for ECONNREFUSED: HTTP 500 with empty body
    maybeNotifySlicerDown({ response: { status: 500, data: '' } })

    await new Promise(r => setTimeout(r, 0))
    await new Promise(r => setTimeout(r, 0))

    expect(healthCheck).toHaveBeenCalledTimes(1)
    expect(store.serverStatus.available).toBe(false)
    expect(store.showServerDialog).toBe(true)
  })
})
