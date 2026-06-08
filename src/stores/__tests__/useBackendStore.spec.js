import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

const healthCheck = vi.hoisted(() => vi.fn())

vi.mock('@/axios/backendService', () => ({
  healthCheck,
}))

describe('useBackendStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    healthCheck.mockReset()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('init() issues exactly one health check and does not start any setInterval', async () => {
    healthCheck.mockResolvedValue({ version: '1.0.0', capabilities: [] })
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval')

    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()

    store.init()
    await vi.runAllTimersAsync()

    expect(healthCheck).toHaveBeenCalledTimes(1)
    expect(setIntervalSpy).not.toHaveBeenCalled()

    // No further calls even after long virtual time
    vi.advanceTimersByTime(5 * 60 * 1000)
    expect(healthCheck).toHaveBeenCalledTimes(1)
  })

  it('does not expose startHealthCheckInterval or stopHealthCheckInterval actions', async () => {
    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()

    expect(store.startHealthCheckInterval).toBeUndefined()
    expect(store.stopHealthCheckInterval).toBeUndefined()
  })

  describe('supportConfig — dental mode defaults', () => {
    async function setupStores(dentalModeRaw) {
      const { useParamsStore } = await import('@/stores/useParamsStore')
      const { useBackendStore } = await import('@/stores/useBackendStore')
      const paramsStore = useParamsStore()
      if (dentalModeRaw !== undefined)
        paramsStore._rawResinJson = { __dental_mode: dentalModeRaw }
      const backendStore = useBackendStore()
      return { paramsStore, backendStore }
    }

    it('initializes to C&B defaults when dentalMode is C&B', async () => {
      const { backendStore } = await setupStores('C&B')
      expect(backendStore.supportConfig.support_head_front_diameter).toBe(0.8)
      expect(backendStore.supportConfig.support_head_penetration).toBe(0.3)
      expect(backendStore.supportConfig.support_pillar_diameter).toBe(1.0)
      expect(backendStore.supportConfig.support_points_density_relative).toBe(150)
      expect(backendStore.supportConfig.support_critical_angle).toBe(30)
    })

    it('initializes to Surgical Guide defaults when dentalMode is Surgical Guide', async () => {
      const { backendStore } = await setupStores('Surgical Guide')
      expect(backendStore.supportConfig.support_head_penetration).toBe(0.4)
      expect(backendStore.supportConfig.support_points_density_relative).toBe(150)
      expect(backendStore.supportConfig.support_critical_angle).toBe(30)
    })

    it('initializes to Splint defaults when dentalMode is Splint', async () => {
      const { backendStore } = await setupStores('Splint')
      expect(backendStore.supportConfig.support_head_penetration).toBe(0.4)
      expect(backendStore.supportConfig.support_points_density_relative).toBe(120)
      expect(backendStore.supportConfig.support_critical_angle).toBe(30)
    })

    it('switches supportConfig when dentalMode changes from C&B to Splint', async () => {
      const { paramsStore, backendStore } = await setupStores('C&B')
      expect(backendStore.supportConfig.support_points_density_relative).toBe(150)

      paramsStore._rawResinJson = { __dental_mode: 'Splint' }
      await nextTick()

      expect(backendStore.supportConfig.support_points_density_relative).toBe(120)
      expect(backendStore.supportConfig.support_head_penetration).toBe(0.4)
    })

    it('does not overwrite supportConfig when dentalMode is Dental Model', async () => {
      const { backendStore } = await setupStores('Dental Model')
      // Should remain at fallback defaults, not be reset to a mode preset
      expect(backendStore.supportConfig.support_head_front_diameter).toBe(0.4)
      expect(backendStore.supportConfig.support_head_penetration).toBe(0.2)
      expect(backendStore.supportConfig.support_points_density_relative).toBe(100)
      expect(backendStore.supportConfig.support_critical_angle).toBe(45)
    })

    it('does not overwrite supportConfig when dentalMode is null', async () => {
      const { backendStore } = await setupStores(undefined)
      expect(backendStore.supportConfig.support_head_front_diameter).toBe(0.4)
      expect(backendStore.supportConfig.support_points_density_relative).toBe(100)
    })

    // Integration: verifies the payload autoProcess would spread into generateSupportMesh
    it('supportConfig spread for C&B one-click processing has correct penetration and density', async () => {
      const { backendStore } = await setupStores('C&B')
      const payload = { ...backendStore.supportConfig }
      expect(payload.support_head_penetration).toBe(0.3)
      expect(payload.support_points_density_relative).toBe(150)
    })

    it('supportConfig spread for Splint one-click processing has density 120', async () => {
      const { backendStore } = await setupStores('Splint')
      const payload = { ...backendStore.supportConfig }
      expect(payload.support_points_density_relative).toBe(120)
    })
  })

  it('checkHealth() success sets available=true, closes dialog, and stores version', async () => {
    healthCheck.mockResolvedValue({ version: '2.0.0', capabilities: ['slice', 'support'] })
    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()
    store.showServerDialog = true

    const ok = await store.checkHealth()

    expect(ok).toBe(true)
    expect(store.serverStatus.available).toBe(true)
    expect(store.serverStatus.version).toBe('2.0.0')
    expect(store.serverStatus.capabilities).toEqual(['slice', 'support'])
    expect(store.showServerDialog).toBe(false)
    expect(store.serverStatus.checking).toBe(false)
  })

  it('checkHealth() failure sets available=false and opens the dialog', async () => {
    healthCheck.mockRejectedValue(new Error('network down'))
    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()

    const ok = await store.checkHealth()

    expect(ok).toBe(false)
    expect(store.serverStatus.available).toBe(false)
    expect(store.showServerDialog).toBe(true)
    expect(store.serverStatus.checking).toBe(false)
  })

  it('serverStatus.checking flips true mid-flight and back to false in finally', async () => {
    let resolveHealth
    healthCheck.mockImplementation(() => new Promise((res) => {
      resolveHealth = res
    }))
    const { useBackendStore } = await import('@/stores/useBackendStore')
    const store = useBackendStore()

    const pending = store.checkHealth()
    expect(store.serverStatus.checking).toBe(true)

    resolveHealth({ version: '1', capabilities: [] })
    await pending
    expect(store.serverStatus.checking).toBe(false)
  })
})
