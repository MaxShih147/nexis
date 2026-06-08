/**
 * Hex grid (honeycomb infill) generation for ortho auto-processing.
 * Adapted from docs/autoProcessing_ortho_helper.js showHexGrid().
 */
import { logger } from '@/utils/logger'
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Raycaster, Vector3 } from 'three'

/**
 * Generate a honeycomb hex grid mesh, with heights adapted to inner mesh ceiling.
 * @param {object} params
 * @param {number} params.radius - Hex cell radius (mm)
 * @param {number} params.fallbackHeight - Fallback prism height if no inner mesh or ray miss (mm)
 * @param {number} params.pyramidHeight - Height of the hexagonal pyramid dome (mm)
 * @param {number} params.wallThickness - Gap between cells (mm)
 * @param {number} params.gridCount - Number of cells per row
 * @param {number} params.bottomZ - Z position of the print bed
 * @param {Mesh} params.hollowMesh - Extended hollow mesh for ray-based height adaptation
 * @returns {Mesh|null} Hex grid mesh or null if no cells built
 */
export function generateHexGrid({
  radius = 5,
  fallbackHeight = 20,
  pyramidHeight = 5,
  wallThickness = 1,
  gridCount = 5,
  bottomZ = 0,
  hollowMesh,
}) {
  const vertices = []
  const indices = []
  let baseIdx = 0
  const verticesPerCell = 14 // 1 bottom center + 6 bottom ring + 6 top ring + 1 apex

  // Honeycomb spacing (flat-top hex)
  const spacing = radius + wallThickness / 2
  const colStep = spacing * Math.sqrt(3)
  const rowStep = spacing * 1.5

  // Center the grid
  const halfCols = (gridCount - 1) / 2
  const halfRows = (gridCount - 1) / 2

  // Setup raycaster for finding inner mesh ceiling
  const raycaster = new Raycaster()
  const rayDir = new Vector3(0, 0, 1) // +Z upward
  const hasHollow = !!hollowMesh

  // Compute inner mesh max Z for fallback height
  let innerMaxZ = fallbackHeight
  if (hasHollow) {
    hollowMesh.geometry.computeBoundingBox()
    const hollowBBox = hollowMesh.geometry.boundingBox
    innerMaxZ = hollowBBox.max.z + hollowMesh.position.z + 5
  }

  let cellsBuilt = 0
  // let cellsSkipped = 0

  for (let row = 0; row < gridCount; row++) {
    for (let col = 0; col < gridCount; col++) {
      const xOffset = (row % 2) * (colStep / 2)
      const cx = (col - halfCols) * colStep + xOffset
      const cy = (row - halfRows) * rowStep

      let prismHeight = fallbackHeight

      if (hasHollow) {
        const rayOrigin = new Vector3(cx, cy, -100)
        raycaster.set(rayOrigin, rayDir)
        const intersects = raycaster.intersectObject(hollowMesh, false)

        if (intersects.length > 0) {
          let maxZ = -Infinity
          for (const hit of intersects) {
            if (hit.point.z > maxZ) {
              maxZ = hit.point.z
            }
          }
          prismHeight = maxZ - pyramidHeight
          if (prismHeight < 1) {
            // cellsSkipped++
            continue
          }
        }
        else {
          prismHeight = innerMaxZ - pyramidHeight
        }
      }

      // Build hex cell inline
      const hexPoints = []
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6
        hexPoints.push({
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        })
      }

      // Bottom center (baseIdx + 0)
      vertices.push(cx, cy, bottomZ)
      // Bottom ring (baseIdx + 1..6)
      for (let i = 0; i < 6; i++) {
        vertices.push(hexPoints[i].x, hexPoints[i].y, bottomZ)
      }
      // Top ring (baseIdx + 7..12)
      for (let i = 0; i < 6; i++) {
        vertices.push(hexPoints[i].x, hexPoints[i].y, prismHeight)
      }
      // Apex (baseIdx + 13)
      vertices.push(cx, cy, prismHeight + pyramidHeight)

      // Bottom face (6 triangles, fan from center)
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6
        indices.push(baseIdx + 0, baseIdx + 1 + next, baseIdx + 1 + i)
      }

      // Prism side faces (6 quads = 12 triangles)
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6
        const b0 = baseIdx + 1 + i
        const b1 = baseIdx + 1 + next
        const t0 = baseIdx + 7 + i
        const t1 = baseIdx + 7 + next
        indices.push(b0, b1, t1)
        indices.push(b0, t1, t0)
      }

      // Pyramid faces (6 triangles)
      for (let i = 0; i < 6; i++) {
        const next = (i + 1) % 6
        indices.push(baseIdx + 7 + i, baseIdx + 7 + next, baseIdx + 13)
      }

      baseIdx += verticesPerCell
      cellsBuilt++
    }
  }

  if (cellsBuilt === 0) {
    logger.warn('No hex cells built - ray misses inner mesh. Try a larger grid or check mesh position.')
    return null
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(vertices), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()

  const material = new MeshStandardMaterial({
    color: 0xD97706,
    roughness: 0.4,
    metalness: 0.1,
  })

  const hexCellMesh = new Mesh(geometry, material)
  hexCellMesh.name = 'hexGridPreview'

  return hexCellMesh
}
