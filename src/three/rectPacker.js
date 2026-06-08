/**
 * MaxRects (Best Short Side Fit) 2D rectangle packer with obstacle support.
 *
 * Classic offline rectangle bin-packing: maintain a list of maximal free
 * rectangles; place each item into the free rect that leaves the smallest
 * short leftover side (BSSF), then split the free rects the placement overlaps
 * and prune contained ones. Pre-occupied regions (e.g. models already on the
 * plate) are carved out of the free list first, so new items pack into the gaps
 * without touching them.
 *
 * All coordinates are in a single 2D space (bin starts at 0,0).
 */

const EPS = 1e-6

function intersects(a, b) {
  return !(b.x >= a.x + a.w || b.x + b.w <= a.x || b.y >= a.y + a.h || b.y + b.h <= a.y)
}

function contains(outer, inner) {
  return inner.x >= outer.x - EPS && inner.y >= outer.y - EPS
    && inner.x + inner.w <= outer.x + outer.w + EPS
    && inner.y + inner.h <= outer.y + outer.h + EPS
}

/**
 * Split a free rect by a used rect → up to 4 maximal sub-rects (the parts of
 * `free` not covered by `used`). Returns [free] unchanged if they don't overlap.
 */
function splitFreeRect(free, used) {
  if (!intersects(free, used))
    return [free]
  const parts = []
  if (used.x > free.x) // left slab
    parts.push({ x: free.x, y: free.y, w: used.x - free.x, h: free.h })
  if (used.x + used.w < free.x + free.w) // right slab
    parts.push({ x: used.x + used.w, y: free.y, w: free.x + free.w - (used.x + used.w), h: free.h })
  if (used.y > free.y) // bottom slab
    parts.push({ x: free.x, y: free.y, w: free.w, h: used.y - free.y })
  if (used.y + used.h < free.y + free.h) // top slab
    parts.push({ x: free.x, y: used.y + used.h, w: free.w, h: free.y + free.h - (used.y + used.h) })
  return parts
}

/**
 * Remove `used` from the free-rect list (split overlapping rects, drop slivers,
 * prune contained rects). Mutates `freeRects`.
 */
function carve(freeRects, used) {
  const next = []
  for (const f of freeRects) {
    for (const p of splitFreeRect(f, used)) {
      if (p.w > EPS && p.h > EPS)
        next.push(p)
    }
  }
  // prune rects fully contained in another
  for (let i = next.length - 1; i >= 0; i--) {
    for (let j = 0; j < next.length; j++) {
      if (i !== j && contains(next[j], next[i])) {
        next.splice(i, 1)
        break
      }
    }
  }
  freeRects.length = 0
  freeRects.push(...next)
}

/**
 * Pack rectangles into a bin, optionally avoiding pre-occupied obstacle rects.
 *
 * @param {{ w: number, h: number }} bin - bin size
 * @param {Array<{ id: any, w: number, h: number }>} items - rectangles to place
 * @param {object} [opts]
 * @param {Array<{ x: number, y: number, w: number, h: number }>} [opts.obstacles] - pre-occupied regions
 * @param {'area'|'maxside'|'height'|'none'} [opts.sort] - order items are placed in (default 'area' = big first)
 * @param {boolean} [opts.allowRotate] - allow 90° rotation of items to fit better
 * @returns {{ placements: Array<{ id: any, x: number, y: number, w: number, h: number, rotated: boolean }>, unplaced: any[] }} placed rects (rotated = 90° turned) + ids that didn't fit
 */
export function packRects(bin, items, { obstacles = [], sort = 'area', allowRotate = false } = {}) {
  const freeRects = [{ x: 0, y: 0, w: bin.w, h: bin.h }]
  for (const o of obstacles)
    carve(freeRects, o)

  // Placement order. 'area' (big first) is the BSSF default — large rects go
  // down first and small ones fill the leftover gaps.
  const order = [...items]
  if (sort === 'area')
    order.sort((a, b) => (b.w * b.h) - (a.w * a.h))
  else if (sort === 'maxside')
    order.sort((a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h))
  else if (sort === 'height')
    order.sort((a, b) => b.h - a.h)

  const placements = []
  const unplaced = []

  for (const it of order) {
    // Candidate orientations: upright, plus 90°-turned when rotation is allowed
    // and the item isn't square.
    const orientations = (allowRotate && Math.abs(it.w - it.h) > EPS)
      ? [{ w: it.w, h: it.h, rotated: false }, { w: it.h, h: it.w, rotated: true }]
      : [{ w: it.w, h: it.h, rotated: false }]

    let best = null
    let bestShort = Infinity
    let bestLong = Infinity
    let bestO = null
    for (const o of orientations) {
      for (const f of freeRects) {
        if (f.w + EPS < o.w || f.h + EPS < o.h)
          continue
        const leftoverH = f.w - o.w
        const leftoverV = f.h - o.h
        const shortSide = Math.min(leftoverH, leftoverV)
        const longSide = Math.max(leftoverH, leftoverV)
        if (shortSide < bestShort - EPS || (Math.abs(shortSide - bestShort) <= EPS && longSide < bestLong)) {
          best = f
          bestShort = shortSide
          bestLong = longSide
          bestO = o
        }
      }
    }
    if (!best) {
      unplaced.push(it.id)
      continue
    }
    const used = { x: best.x, y: best.y, w: bestO.w, h: bestO.h }
    placements.push({ id: it.id, ...used, rotated: bestO.rotated })
    carve(freeRects, used)
  }

  return { placements, unplaced }
}
