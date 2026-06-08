/**
 * 2D geometry utilities for ortho auto-processing.
 * Pure functions used by side-wall drain generation.
 */

/**
 * Compute signed area of a 2D polygon using the Shoelace formula.
 * @param {Array<{x: number, y: number}>} poly - Array of 2D points
 * @returns {number} Signed area (positive = CCW, negative = CW)
 */
export function polyArea2D(poly) {
  let area = 0
  const n = poly.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += poly[i].x * poly[j].y
    area -= poly[j].x * poly[i].y
  }
  return area / 2
}

/**
 * Test if a point is inside a 2D polygon using ray casting.
 * @param {Array<{x: number, y: number}>} poly - Array of 2D points
 * @param {number} px - Test point X
 * @param {number} py - Test point Y
 * @returns {boolean} True if point is inside
 */
export function pointInPolygon2D(poly, px, py) {
  let inside = false
  const n = poly.length
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

/**
 * 2D ray-segment intersection test.
 * @param {number} ox - Ray origin X
 * @param {number} oy - Ray origin Y
 * @param {number} dx - Ray direction X
 * @param {number} dy - Ray direction Y
 * @param {number} ax - Segment start X
 * @param {number} ay - Segment start Y
 * @param {number} bx - Segment end X
 * @param {number} by - Segment end Y
 * @returns {number|null} Parameter t along ray, or null if no intersection
 */
export function raySegIntersect2D(ox, oy, dx, dy, ax, ay, bx, by) {
  const ex = bx - ax
  const ey = by - ay
  const denom = dx * ey - dy * ex
  if (Math.abs(denom) < 1e-12)
    return null
  const t = ((ax - ox) * ey - (ay - oy) * ex) / denom
  const u = ((ax - ox) * dy - (ay - oy) * dx) / denom
  if (u >= 0 && u <= 1 && t >= 0)
    return t
  return null
}
