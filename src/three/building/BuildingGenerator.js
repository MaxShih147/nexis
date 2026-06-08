import { Box3, BoxGeometry, ExtrudeGeometry, Group, Mesh, MeshStandardMaterial, Shape, Vector3 } from 'three'

/**
 * BuildingGenerator — procedurally generates a plausible single-floor factory
 * shell (perimeter + interior partition walls with doorways, plus square
 * columns at wall junctions) for the nexis digital twin.
 *
 * Layout uses binary space partitioning (BSP): the floor rectangle is split
 * recursively into rooms, respecting target room count and min/max room area.
 * Each split line becomes an interior wall; a doorway gap is cut into walls
 * long enough to host one. Columns are placed at perimeter corners and interior
 * wall junctions.
 *
 * Returns a THREE.Group (named "building") with `walls` and `columns` subgroups.
 * Every part mesh gets a BVH (computeBoundsTree) so it is collision-ready, and
 * carries userData.buildingPart for later "object vs building" interference.
 *
 * @typedef {object} BuildingParams
 * @property {number} floorWidth   platform width  (X), default 300
 * @property {number} floorDepth   platform depth  (Y), default 300
 * @property {number} wallHeight   wall/column height (Z), default 100
 * @property {number} wallThickness wall thickness, default 4
 * @property {number} columnSize   square column side length, default 12
 * @property {number} rooms        target number of partitions, default 6
 * @property {number} minRoomArea  minimum room area, default 4000
 * @property {number} maxRoomArea  maximum room area, default 30000
 * @property {number} doorWidth    doorway opening width, default 24
 * @property {number} seed         PRNG seed for reproducible layouts, default 1
 */

// All lengths are in centimetres (cm); areas in cm².
export const DEFAULT_BUILDING_PARAMS = {
  floorWidth: 1155, // derived from rooms × room area (see computeFloorSize)
  floorDepth: 1155,
  wallHeight: 260,
  wallThickness: 15,
  columnSize: 30,
  rooms: 3,
  minRoomArea: 250000, // 25 m²
  maxRoomArea: 640000, // 64 m²
  doorWidth: 80,
  doorHeight: 200, // door opening height (cm); wall above stays as a lintel
  minColumnSpacing: 400, // structural column grid spacing (cm); columns stay aligned
  seed: 1,
}

/**
 * Derive a square floor size that comfortably fits `rooms` rooms of the target
 * area. The platform follows the building rather than the other way round.
 * @param {Partial<BuildingParams>} [params]
 * @returns {{ width: number, height: number }}
 */
export function computeFloorSize(params = {}) {
  const p = { ...DEFAULT_BUILDING_PARAMS, ...params }
  const target = Math.min(p.maxRoomArea, Math.max(p.minRoomArea, (p.minRoomArea + p.maxRoomArea) / 2))
  const side = Math.sqrt(Math.max(1, p.rooms) * target)
  return { width: side, height: side }
}

/** Deterministic PRNG (mulberry32) so a seed reproduces a layout. */
function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const area = r => (r.x1 - r.x0) * (r.y1 - r.y0)

/**
 * Try to split a rectangle into two rooms each ≥ minArea. Splits the longer
 * side so rooms stay reasonably boxy; the cut ratio is jittered in [0.35,0.65].
 */
function trySplit(rng, rect, minArea) {
  const w = rect.x1 - rect.x0
  const d = rect.y1 - rect.y0
  const splitVertical = w >= d // a vertical wall (constant x)

  for (let attempt = 0; attempt < 8; attempt++) {
    const ratio = 0.35 + rng() * 0.30
    if (splitVertical) {
      const xs = rect.x0 + w * ratio
      if ((xs - rect.x0) * d >= minArea && (rect.x1 - xs) * d >= minArea) {
        return {
          a: { x0: rect.x0, y0: rect.y0, x1: xs, y1: rect.y1 },
          b: { x0: xs, y0: rect.y0, x1: rect.x1, y1: rect.y1 },
          line: { axis: 'x', pos: xs, a: rect.y0, b: rect.y1 },
        }
      }
    }
    else {
      const ys = rect.y0 + d * ratio
      if ((ys - rect.y0) * w >= minArea && (rect.y1 - ys) * w >= minArea) {
        return {
          a: { x0: rect.x0, y0: rect.y0, x1: rect.x1, y1: ys },
          b: { x0: rect.x0, y0: ys, x1: rect.x1, y1: rect.y1 },
          line: { axis: 'y', pos: ys, a: rect.x0, b: rect.x1 },
        }
      }
    }
  }
  return null
}

/**
 * BSP partition the floor into rooms; collect interior split lines.
 * Room count is the hard target; minRoomArea keeps splits from making slivers.
 * (maxRoomArea only guides floor sizing via computeFloorSize.)
 */
function partitionFloor(rng, floorRect, { rooms, minRoomArea }) {
  const rects = [floorRect]
  const splits = []

  let guard = 0
  while (guard++ < 2000) {
    if (rects.length >= rooms)
      break

    // Split the largest splittable rectangle first.
    rects.sort((p, q) => area(q) - area(p))
    let didSplit = false
    for (const rect of rects) {
      const s = trySplit(rng, rect, minRoomArea)
      if (s) {
        rects.splice(rects.indexOf(rect), 1, s.a, s.b)
        splits.push(s.line)
        didSplit = true
        break
      }
    }
    if (!didSplit)
      break
  }

  return { rooms: rects, splits }
}

/**
 * Build one wall along [a,b] (at constant `pos` on `axis`), optionally with a
 * doorway: left + right full-height side pieces plus a lintel above the opening
 * (so the door is `doorHeight` tall, not full wall height).
 * @returns {Mesh[]}
 */
function buildWall(rng, axis, pos, a, b, p, withDoor) {
  const margin = Math.max(p.columnSize, p.doorWidth * 0.6)
  const length = b - a
  const canDoor = withDoor && length >= p.doorWidth + 2 * margin

  if (!canDoor) {
    const m = makeWallBox(axis, pos, a, b, p.wallThickness, 0, p.wallHeight)
    return m ? [m] : []
  }

  const minCenter = a + margin + p.doorWidth / 2
  const maxCenter = b - margin - p.doorWidth / 2
  const center = minCenter + rng() * (maxCenter - minCenter)
  const ds = center - p.doorWidth / 2
  const de = center + p.doorWidth / 2
  const doorTop = Math.min(p.doorHeight, p.wallHeight)

  // Full-height opening → two separate side pieces (no lintel needed).
  if (doorTop >= p.wallHeight - 0.01) {
    return [
      makeWallBox(axis, pos, a, ds, p.wallThickness, 0, p.wallHeight),
      makeWallBox(axis, pos, de, b, p.wallThickness, 0, p.wallHeight),
    ].filter(Boolean)
  }

  // Door shorter than the wall: build the whole wall (jambs + lintel) as ONE
  // extruded mesh with a door-shaped notch, so transparent faces never overlap
  // (the piecewise lintel showed seams through the glass).
  const m = makeWallWithDoor(axis, pos, a, b, p.wallThickness, p.wallHeight, ds, de, doorTop)
  return m ? [m] : []
}

/** A single seamless wall mesh with a door-shaped notch cut from the bottom. */
function makeWallWithDoor(axis, pos, a, b, thickness, height, doorStart, doorEnd, doorHeight) {
  const length = b - a
  if (length <= 0.01 || height <= 0.01)
    return null

  const cx = (a + b) / 2
  const ds = doorStart - cx // door coords relative to wall centre
  const de = doorEnd - cx
  const dh = Math.min(doorHeight, height)

  // Outline in (along-wall u, height v): rectangle with a notch at the bottom.
  const shape = new Shape()
  shape.moveTo(-length / 2, 0)
  shape.lineTo(ds, 0)
  shape.lineTo(ds, dh)
  shape.lineTo(de, dh)
  shape.lineTo(de, 0)
  shape.lineTo(length / 2, 0)
  shape.lineTo(length / 2, height)
  shape.lineTo(-length / 2, height)
  shape.closePath()

  const geo = new ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false })
  geo.translate(0, 0, -thickness / 2) // centre the thickness on the wall line
  // Stand the wall up: local (u→X, v→Y, depth→Z) into world.
  if (axis === 'y') {
    geo.rotateX(Math.PI / 2) // along-wall → world X, height → world Z
  }
  else {
    geo.rotateX(Math.PI / 2)
    geo.rotateZ(Math.PI / 2) // along-wall → world Y
  }
  geo.computeBoundsTree?.()

  const mesh = new Mesh(geo, wallMaterial())
  if (axis === 'y')
    mesh.position.set(cx, pos, 0)
  else
    mesh.position.set(pos, cx, 0)
  mesh.name = 'wall'
  mesh.userData.buildingPart = 'wall'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

/** A wall box spanning [start,end] horizontally and [z0,z1] vertically. */
function makeWallBox(axis, pos, start, end, thickness, z0, z1) {
  const length = end - start
  const height = z1 - z0
  if (length <= 0.01 || height <= 0.01)
    return null

  let sx
  let sy
  let cx
  let cy
  if (axis === 'x') {
    // vertical wall (constant x), spans along y
    sx = thickness
    sy = length
    cx = pos
    cy = (start + end) / 2
  }
  else {
    // horizontal wall (constant y), spans along x
    sx = length
    sy = thickness
    cx = (start + end) / 2
    cy = pos
  }

  const geo = new BoxGeometry(sx, sy, height)
  geo.computeBoundsTree?.()
  const mesh = new Mesh(geo, wallMaterial())
  mesh.position.set(cx, cy, (z0 + z1) / 2)
  mesh.name = 'wall'
  mesh.userData.buildingPart = 'wall'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// nexis: building parts are semi-transparent green for now (tunable later).
const BUILDING_COLOR = 0x22C55E

function wallMaterial() {
  return new MeshStandardMaterial({
    color: BUILDING_COLOR,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.30,
    depthWrite: false,
  })
}

function columnMaterial() {
  return new MeshStandardMaterial({
    color: BUILDING_COLOR,
    roughness: 0.8,
    metalness: 0.1,
    transparent: true,
    opacity: 0.50,
    depthWrite: false,
  })
}

function key(x, y) {
  return `${Math.round(x * 10)}:${Math.round(y * 10)}`
}

/**
 * Generate a building shell group.
 * @param {Partial<BuildingParams>} [params]
 * @returns {Group}
 */
export function generateBuilding(params = {}) {
  const p = { ...DEFAULT_BUILDING_PARAMS, ...params }
  const rng = makeRng(p.seed)

  const halfW = p.floorWidth / 2
  const halfD = p.floorDepth / 2
  const floorRect = { x0: -halfW, y0: -halfD, x1: halfW, y1: halfD }

  const { rooms, splits } = partitionFloor(rng, floorRect, p)

  const buildingGroup = new Group()
  buildingGroup.name = 'building'
  const wallsGroup = new Group()
  wallsGroup.name = 'building-walls'
  const columnsGroup = new Group()
  columnsGroup.name = 'building-columns'

  // Perimeter walls (one doorway on a random side as the entrance)
  const entranceSide = Math.floor(rng() * 4)
  const perimeter = [
    { axis: 'y', pos: -halfD, a: -halfW, b: halfW }, // front (y-)
    { axis: 'y', pos: halfD, a: -halfW, b: halfW }, // back  (y+)
    { axis: 'x', pos: -halfW, a: -halfD, b: halfD }, // left  (x-)
    { axis: 'x', pos: halfW, a: -halfD, b: halfD }, // right (x+)
  ]
  perimeter.forEach((w, i) => {
    for (const m of buildWall(rng, w.axis, w.pos, w.a, w.b, p, i === entranceSide))
      wallsGroup.add(m)
  })

  // Interior partition walls, each with one doorway
  for (const line of splits) {
    for (const m of buildWall(rng, line.axis, line.pos, line.a, line.b, p, true))
      wallsGroup.add(m)
  }

  // Structural column grid: a regular, axis-aligned lattice spanning the floor.
  // Bay spacing is the largest even division that stays ≥ minColumnSpacing, so
  // columns line up in rows/columns (no horizontal/vertical offset) and can fall
  // in the middle of rooms — independent of the partition walls.
  const colPoints = new Map()
  const addCol = (x, y) => {
    const cx = Math.max(-halfW + p.columnSize / 2, Math.min(halfW - p.columnSize / 2, x))
    const cy = Math.max(-halfD + p.columnSize / 2, Math.min(halfD - p.columnSize / 2, y))
    colPoints.set(key(cx, cy), { x: cx, y: cy })
  }

  const spacing = Math.max(1, p.minColumnSpacing)
  const baysX = Math.max(1, Math.floor(p.floorWidth / spacing))
  const baysY = Math.max(1, Math.floor(p.floorDepth / spacing))
  const stepX = p.floorWidth / baysX
  const stepY = p.floorDepth / baysY
  for (let i = 0; i <= baysX; i++) {
    for (let j = 0; j <= baysY; j++) {
      addCol(-halfW + i * stepX, -halfD + j * stepY)
    }
  }

  for (const { x, y } of colPoints.values()) {
    const geo = new BoxGeometry(p.columnSize, p.columnSize, p.wallHeight)
    geo.computeBoundsTree?.()
    const col = new Mesh(geo, columnMaterial())
    col.position.set(x, y, p.wallHeight / 2)
    col.name = 'column'
    col.userData.buildingPart = 'column'
    col.castShadow = true
    col.receiveShadow = true
    columnsGroup.add(col)
  }

  buildingGroup.add(wallsGroup, columnsGroup)
  buildingGroup.userData = {
    isBuilding: true,
    params: p,
    roomCount: rooms.length,
    rooms: rooms.map(r => ({
      x0: r.x0,
      y0: r.y0,
      x1: r.x1,
      y1: r.y1,
      area: area(r),
    })),
    wallCount: wallsGroup.children.length,
    columnCount: columnsGroup.children.length,
    bounds: new Box3().setFromCenterAndSize(
      new Vector3(0, 0, p.wallHeight / 2),
      new Vector3(p.floorWidth, p.floorDepth, p.wallHeight),
    ),
  }

  return buildingGroup
}
