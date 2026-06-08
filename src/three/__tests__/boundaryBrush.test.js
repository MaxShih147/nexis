import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'
import { BoundaryBrush } from '../boundaryBrush'

function createBrush() {
  const listeners = {}
  const domElement = {
    addEventListener: vi.fn((type, handler) => {
      listeners[type] = handler
    }),
    removeEventListener: vi.fn(),
    style: {
      cursor: '',
    },
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    getBoundingClientRect: vi.fn(() => ({ left: 0, top: 0, width: 100, height: 100 })),
  }
  const brush = new BoundaryBrush({
    domElement,
    camera: {},
    scene: { add: vi.fn(), remove: vi.fn() },
    render: vi.fn(),
    setOrbitEnabled: vi.fn(),
    setDragEnabled: vi.fn(),
    getModels: vi.fn(() => []),
  })
  brush.init([], [{ points: [[0, 0, 0], [1, 0, 0], [0, 1, 0]] }])
  return { brush, domElement, listeners }
}

function pointerEvent(overrides = {}) {
  return {
    button: 0,
    shiftKey: false,
    pointerId: 1,
    stopImmediatePropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  }
}

describe('boundaryBrush adjustment-mode interaction', () => {
  it('starts a surface stroke without requiring Shift', () => {
    const { brush, domElement } = createBrush()
    brush._raycastMeshSurface = vi.fn(() => new Vector3(0, 0, 0))

    brush._onPointerDown(pointerEvent())

    expect(brush._drawing).toBe(true)
    expect(domElement.setPointerCapture).toHaveBeenCalledWith(1)
  })

  it('does not start or preview a stroke when the pointer is off the model surface', () => {
    const { brush, domElement } = createBrush()
    const event = pointerEvent()
    brush._raycastMeshSurface = vi.fn(() => null)

    brush._onPointerDown(event)

    expect(brush._drawing).toBe(false)
    expect(brush._previewLine).toBeNull()
    expect(event.stopImmediatePropagation).not.toHaveBeenCalled()
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(domElement.setPointerCapture).not.toHaveBeenCalled()
  })
})
