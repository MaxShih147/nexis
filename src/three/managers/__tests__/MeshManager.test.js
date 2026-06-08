import { Mesh, MeshBasicMaterial, Object3D } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MeshManager } from '../MeshManager'

const parseMock = vi.fn()
let exportedChildNames = []

vi.mock('three/examples/jsm/exporters/STLExporter', () => ({
  STLExporter: class {
    parse(...args) {
      return parseMock(...args)
    }
  },
}))

function makeModelWithChildren() {
  const model = new Object3D()
  const keepChild = new Mesh(undefined, new MeshBasicMaterial())
  keepChild.name = 'keep-child'
  const filteredChild = new Mesh(undefined, new MeshBasicMaterial())
  filteredChild.name = 'filtered-child'

  model.add(keepChild)
  model.add(filteredChild)

  return { model, keepChild, filteredChild }
}

describe('meshManager exportBinarySTL', () => {
  beforeEach(() => {
    parseMock.mockReset()
    exportedChildNames = []
    parseMock.mockImplementation((model) => {
      exportedChildNames = model.children.map(child => child.name)
      return new ArrayBuffer(16)
    })
  })

  it('exports all children by default', () => {
    const { model } = makeModelWithChildren()

    const blob = MeshManager.prototype.exportBinarySTL.call({}, model)

    expect(blob).toBeInstanceOf(Blob)
    expect(parseMock).toHaveBeenCalledWith(model, { binary: true })
    expect(model.children).toHaveLength(2)
  })

  it('can filter out all children during export and restores them afterward', () => {
    const { model, keepChild, filteredChild } = makeModelWithChildren()

    MeshManager.prototype.exportBinarySTL.call({}, model, { filterChildren: true })

    expect(exportedChildNames).toEqual([])
    expect(model.children).toEqual([keepChild, filteredChild])
  })

  it('can keep only children accepted by childFilter during export', () => {
    const { model, keepChild, filteredChild } = makeModelWithChildren()

    MeshManager.prototype.exportBinarySTL.call({}, model, {
      childFilter: child => child.name === 'keep-child',
    })

    expect(exportedChildNames).toEqual([keepChild.name])
    expect(model.children).toEqual([keepChild, filteredChild])
  })
})
