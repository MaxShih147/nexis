import { describe, expect, it } from 'vitest'
import { packRects } from '../rectPacker'

function overlaps(a, b) {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y)
}

describe('packRects (MaxRects)', () => {
  it('packs equal squares without overlap and within the bin', () => {
    const items = [0, 1, 2, 3].map(id => ({ id, w: 40, h: 40 }))
    const { placements, unplaced } = packRects({ w: 100, h: 100 }, items)

    expect(unplaced).toEqual([])
    expect(placements).toHaveLength(4)
    for (const p of placements) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.x + p.w).toBeLessThanOrEqual(100 + 1e-6)
      expect(p.y + p.h).toBeLessThanOrEqual(100 + 1e-6)
    }
    // no pairwise overlap
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++)
        expect(overlaps(placements[i], placements[j])).toBe(false)
    }
  })

  it('does NOT spread a few items into a single row (compact)', () => {
    // 4 squares in a 100x100 bin should use 2 columns (compact), not 1.
    const items = [0, 1, 2, 3].map(id => ({ id, w: 40, h: 40 }))
    const { placements } = packRects({ w: 100, h: 100 }, items)
    const distinctX = new Set(placements.map(p => Math.round(p.x)))
    expect(distinctX.size).toBeGreaterThanOrEqual(2)
  })

  it('avoids obstacles (existing models)', () => {
    const obstacle = { x: 0, y: 0, w: 60, h: 100 }
    const items = [{ id: 'a', w: 30, h: 30 }]
    const { placements, unplaced } = packRects({ w: 100, h: 100 }, items, { obstacles: [obstacle] })

    expect(unplaced).toEqual([])
    expect(overlaps(placements[0], obstacle)).toBe(false)
  })

  it('reports items that do not fit as unplaced', () => {
    const items = [{ id: 'big', w: 200, h: 200 }, { id: 'ok', w: 10, h: 10 }]
    const { placements, unplaced } = packRects({ w: 100, h: 100 }, items)
    expect(unplaced).toContain('big')
    expect(placements.map(p => p.id)).toContain('ok')
  })

  it('rotates an item 90° to fit when allowRotate is on', () => {
    // 80x20 item into a 30x100 bin only fits turned (20x80).
    const item = [{ id: 'long', w: 80, h: 20 }]
    const bin = { w: 30, h: 100 }

    const without = packRects(bin, item)
    expect(without.unplaced).toEqual(['long'])

    const withRot = packRects(bin, item, { allowRotate: true })
    expect(withRot.unplaced).toEqual([])
    expect(withRot.placements[0].rotated).toBe(true)
    expect(withRot.placements[0].w).toBe(20)
    expect(withRot.placements[0].h).toBe(80)
  })

  it('big-first (area) places a mixed set with no overlap', () => {
    const items = [
      { id: 0, w: 25, h: 25 },
      { id: 1, w: 75, h: 25 },
      { id: 2, w: 25, h: 66 },
      { id: 3, w: 35, h: 35 },
      { id: 4, w: 55, h: 15 },
      { id: 5, w: 50, h: 50 },
      { id: 6, w: 30, h: 30 },
    ]
    const { placements, unplaced } = packRects({ w: 400, h: 400 }, items, { sort: 'area' })
    expect(unplaced).toEqual([])
    expect(placements).toHaveLength(items.length)
    for (let i = 0; i < placements.length; i++) {
      for (let j = i + 1; j < placements.length; j++)
        expect(overlaps(placements[i], placements[j])).toBe(false)
    }
  })
})
