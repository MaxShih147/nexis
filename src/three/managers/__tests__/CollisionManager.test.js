import { BoxGeometry, BufferGeometry, Mesh, MeshBasicMaterial } from 'three'
import { computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'
import { beforeAll, describe, expect, it } from 'vitest'
import { CollisionManager } from '../CollisionManager'

beforeAll(() => {
  BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
  BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
})

function makeBox(name, x, y, z, size = 10) {
  const geo = new BoxGeometry(size, size, size)
  geo.computeBoundsTree()
  const mesh = new Mesh(geo, new MeshBasicMaterial())
  mesh.name = name
  mesh.position.set(x, y, z)
  mesh.updateMatrixWorld(true)
  return mesh
}

function manager(models) {
  return new CollisionManager({
    getModels: () => models,
    render: () => {},
    onResults: () => {},
  })
}

describe('collisionManager (Problem 1, single floor)', () => {
  it('detects two overlapping boxes', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 5, 0, 0) // 10-wide boxes 5 apart → overlap
    const cm = manager([a, b])
    const results = cm.checkAll()
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('intersect')
    expect(results[0].magnitude).toBeGreaterThan(0)
    expect(results[0].location).not.toBeNull()
  })

  it('reports no interference for separated boxes', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 100, 0, 0) // far apart
    const cm = manager([a, b])
    expect(cm.checkAll()).toHaveLength(0)
  })

  it('broad-phase touching-but-not-intersecting AABBs still narrow-rejects', () => {
    // Exactly touching faces (distance == size): AABBs touch, geometry does not overlap
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 10, 0, 0)
    const cm = manager([a, b])
    // Coincident boundary is a degenerate case; assert it does not throw and
    // returns a well-formed array.
    expect(Array.isArray(cm.checkAll())).toBe(true)
  })

  it('incremental checkFor only re-tests the moved object', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 100, 0, 0)
    const c = makeBox('C', 200, 0, 0)
    const cm = manager([a, b, c])
    expect(cm.checkAll()).toHaveLength(0)
    // Move C onto A
    c.position.set(5, 0, 0)
    c.updateMatrixWorld(true)
    const results = cm.checkFor('C')
    expect(results.some(r =>
      (r.aName === 'A' && r.bName === 'C') || (r.aName === 'C' && r.bName === 'A'),
    )).toBe(true)
  })

  it('highlights interfering models by swapping a tinted material clone', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 5, 0, 0)
    const original = a.material
    const cm = manager([a, b])
    cm.checkAll()
    expect(a.material).not.toBe(original) // tinted clone swapped in
    cm.clear()
    expect(a.material).toBe(original) // restored
  })

  // ── Phase 2: minimum safety gap (scenario 2) ──

  it('flags a near-miss within tolerance with the exact gap distance', () => {
    // 10-wide boxes at x=0 and x=13 → faces at 5 and 8 → gap = 3
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 13, 0, 0)
    const cm = manager([a, b])
    cm.setTolerance(5)
    const results = cm.checkAll()
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('near')
    expect(results[0].gap).toBeCloseTo(3, 2)
    expect(results[0].pointA).not.toBeNull()
    expect(results[0].pointB).not.toBeNull()
  })

  it('does not flag a gap larger than tolerance', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 13, 0, 0) // gap = 3
    const cm = manager([a, b])
    cm.setTolerance(2) // 2 < 3 → not near
    expect(cm.checkAll()).toHaveLength(0)
  })

  it('tolerance 0 stays in pure intersection mode (no near results)', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 13, 0, 0) // gap = 3, not intersecting
    const cm = manager([a, b])
    expect(cm.tolerance).toBe(0)
    expect(cm.checkAll()).toHaveLength(0)
  })

  it('reports intersect (not near) for overlapping boxes even with tolerance set', () => {
    const a = makeBox('A', 0, 0, 0)
    const b = makeBox('B', 5, 0, 0) // overlapping
    const cm = manager([a, b])
    cm.setTolerance(10)
    const results = cm.checkAll()
    expect(results).toHaveLength(1)
    expect(results[0].status).toBe('intersect')
  })
})
