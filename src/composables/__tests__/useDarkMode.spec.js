import { useDarkMode } from '@/composables/useDarkMode'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

function mountWithDarkMode() {
  let api
  const wrapper = mount(defineComponent({
    setup() {
      api = useDarkMode()
      return () => h('div', api.isDark.value ? 'dark' : 'light')
    },
  }))
  return { wrapper, api }
}

describe('useDarkMode', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark')
  })

  it('reads the current dark class on mount', () => {
    document.documentElement.classList.add('dark')
    const { wrapper, api } = mountWithDarkMode()
    expect(api.isDark.value).toBe(true)
    wrapper.unmount()
  })

  it('toggleDarkMode flips both the html class and isDark', async () => {
    const { wrapper, api } = mountWithDarkMode()
    expect(api.isDark.value).toBe(false)

    api.toggleDarkMode()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(api.isDark.value).toBe(true)

    api.toggleDarkMode()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(api.isDark.value).toBe(false)

    wrapper.unmount()
  })

  it('mirrors external mutations to the html class via MutationObserver', async () => {
    const { wrapper, api } = mountWithDarkMode()
    expect(api.isDark.value).toBe(false)

    document.documentElement.classList.add('dark')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(api.isDark.value).toBe(true)

    document.documentElement.classList.remove('dark')
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(api.isDark.value).toBe(false)

    wrapper.unmount()
  })
})
