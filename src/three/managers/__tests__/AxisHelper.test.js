import { describe, expect, it, vi } from 'vitest'

import { AxisHelper } from '../AxisHelper.js'

const { ViewportGizmoMock } = vi.hoisted(() => {
  class MockViewportGizmo {
    constructor() {
      this._domElement = { style: {} }
      this.children = []
    }

    addEventListener() {}
    attachControls() {}
    dispose() {}
    render() {
      this._domElement.style.zIndex = '1000'
    }

    set() {
      this._domElement.style.zIndex = '1000'
    }

    update() {
      this._domElement.style.zIndex = '1000'
    }
  }

  return {
    ViewportGizmoMock: MockViewportGizmo,
  }
})

vi.mock('three-viewport-gizmo', () => ({
  ViewportGizmo: ViewportGizmoMock,
}))

describe('axisHelper overlay layering', () => {
  it('sets the gizmo dom element z-index to 20', () => {
    const renderer = {
      capabilities: {
        getMaxAnisotropy: () => 1,
      },
      render: vi.fn(),
    }

    const helper = new AxisHelper({}, renderer, {})

    expect(helper.gizmo._domElement.style.zIndex).toBe('20')
  })

  it('re-applies z-index 20 after gizmo lifecycle methods mutate it', () => {
    const renderer = {
      capabilities: {
        getMaxAnisotropy: () => 1,
      },
      render: vi.fn(),
    }

    const helper = new AxisHelper({}, renderer, {})

    helper.render()
    expect(helper.gizmo._domElement.style.zIndex).toBe('20')

    helper.customize({ faceColor: 0xFFFFFF })
    expect(helper.gizmo._domElement.style.zIndex).toBe('20')

    helper.update()
    expect(helper.gizmo._domElement.style.zIndex).toBe('20')
  })
})
