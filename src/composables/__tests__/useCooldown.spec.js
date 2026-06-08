import { useCooldown } from '@/composables/useCooldown'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

function mountWithCooldown(seconds) {
  let api
  const wrapper = mount(defineComponent({
    setup() {
      api = useCooldown(seconds)
      return () => h('div', String(api.remaining.value))
    },
  }))
  return { wrapper, api }
}

describe('useCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down from the given duration to zero', async () => {
    const { wrapper, api } = mountWithCooldown(3)

    api.start()
    expect(api.remaining.value).toBe(3)

    await vi.advanceTimersByTimeAsync(1000)
    expect(api.remaining.value).toBe(2)

    await vi.advanceTimersByTimeAsync(2000)
    expect(api.remaining.value).toBe(0)

    await vi.advanceTimersByTimeAsync(1000)
    expect(api.remaining.value).toBe(0)

    wrapper.unmount()
  })

  it('restarts cleanly when start() is called mid-countdown', async () => {
    const { wrapper, api } = mountWithCooldown(5)

    api.start()
    await vi.advanceTimersByTimeAsync(2000)
    expect(api.remaining.value).toBe(3)

    api.start()
    expect(api.remaining.value).toBe(5)

    await vi.advanceTimersByTimeAsync(1000)
    expect(api.remaining.value).toBe(4)

    wrapper.unmount()
  })

  it('stop() resets remaining to 0 and halts the interval', async () => {
    const { wrapper, api } = mountWithCooldown(5)

    api.start()
    await vi.advanceTimersByTimeAsync(1000)
    api.stop()
    expect(api.remaining.value).toBe(0)

    await vi.advanceTimersByTimeAsync(2000)
    expect(api.remaining.value).toBe(0)

    wrapper.unmount()
  })

  it('clears the interval on unmount', async () => {
    const { wrapper, api } = mountWithCooldown(5)

    api.start()
    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(2000)
    expect(api.remaining.value).toBe(0)
  })
})
