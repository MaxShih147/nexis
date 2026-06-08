import JSZip from 'jszip'
import { BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Uint32BufferAttribute, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { buildContentTypes, buildModelXml, buildRels } from '../xmlBuilder'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a simple triangle geometry (3 verts, 1 face) */
function makeTriangleGeometry() {
  const positions = new Float32Array([0, 0, 0, 10, 0, 0, 5, 10, 0])
  const indices = new Uint32Array([0, 1, 2])
  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geom.setIndex(new Uint32BufferAttribute(indices, 1))
  geom.computeVertexNormals()
  return geom
}

/** Create a box-like geometry (8 verts, 12 tris) */
function makeBoxGeometry() {
  const positions = new Float32Array([
    -1,
    -1,
    -1,
    1,
    -1,
    -1,
    1,
    1,
    -1,
    -1,
    1,
    -1,
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1,
    1,
  ])
  const indices = new Uint32Array([
    0,
    1,
    2,
    0,
    2,
    3,
    4,
    6,
    5,
    4,
    7,
    6,
    0,
    5,
    1,
    0,
    4,
    5,
    2,
    7,
    3,
    2,
    6,
    7,
    0,
    7,
    4,
    0,
    3,
    7,
    1,
    5,
    6,
    1,
    6,
    2,
  ])
  const geom = new BufferGeometry()
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geom.setIndex(new Uint32BufferAttribute(indices, 1))
  geom.computeVertexNormals()
  return geom
}

/** Parse 3MF model XML and extract objects (mirrors ProjectReader logic) */
function parseModelXml(xmlString) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, 'application/xml')
  const objects = []

  for (const objEl of doc.getElementsByTagName('object')) {
    const objectId = Number.parseInt(objEl.getAttribute('id'), 10)
    const name = objEl.getAttribute('name') || ''
    const meshEl = objEl.getElementsByTagName('mesh')[0]
    if (!meshEl)
      continue

    const vertexEls = meshEl.getElementsByTagName('vertex')
    const positions = new Float32Array(vertexEls.length * 3)
    for (let i = 0; i < vertexEls.length; i++) {
      positions[i * 3] = Number.parseFloat(vertexEls[i].getAttribute('x'))
      positions[i * 3 + 1] = Number.parseFloat(vertexEls[i].getAttribute('y'))
      positions[i * 3 + 2] = Number.parseFloat(vertexEls[i].getAttribute('z'))
    }

    const triEls = meshEl.getElementsByTagName('triangle')
    const indices = new Uint32Array(triEls.length * 3)
    for (let i = 0; i < triEls.length; i++) {
      indices[i * 3] = Number.parseInt(triEls[i].getAttribute('v1'), 10)
      indices[i * 3 + 1] = Number.parseInt(triEls[i].getAttribute('v2'), 10)
      indices[i * 3 + 2] = Number.parseInt(triEls[i].getAttribute('v3'), 10)
    }

    objects.push({ objectId, name, positions, indices })
  }

  // Parse build items for transforms
  const items = []
  for (const itemEl of doc.getElementsByTagName('item')) {
    items.push({
      objectId: Number.parseInt(itemEl.getAttribute('objectid'), 10),
      transform: itemEl.getAttribute('transform'),
    })
  }

  return { objects, items }
}

/** Parse a 3MF transform string → Matrix4 (same as ProjectReader) */
function parseTransform(str) {
  const v = str.trim().split(/\s+/).map(Number)
  if (v.length !== 12)
    return new Matrix4()
  const m = new Matrix4()
  m.set(
    v[0],
    v[3],
    v[6],
    v[9],
    v[1],
    v[4],
    v[7],
    v[10],
    v[2],
    v[5],
    v[8],
    v[11],
    0,
    0,
    0,
    1,
  )
  return m
}

// ---------------------------------------------------------------------------
// Tests: xmlBuilder
// ---------------------------------------------------------------------------

describe('xmlBuilder', () => {
  describe('buildContentTypes', () => {
    it('produces valid XML with required content types', () => {
      const xml = buildContentTypes()
      expect(xml).toContain('<?xml')
      expect(xml).toContain('Extension="rels"')
      expect(xml).toContain('Extension="model"')
      expect(xml).toContain('Extension="json"')
      expect(xml).toContain('3dmanufacturing')
    })
  })

  describe('buildRels', () => {
    it('produces valid XML with relationship to 3dmodel', () => {
      const xml = buildRels()
      expect(xml).toContain('<?xml')
      expect(xml).toContain('Target="/3D/3dmodel.model"')
      expect(xml).toContain('3dmanufacturing')
    })
  })

  describe('buildModelXml', () => {
    it('generates correct XML for a single triangle', () => {
      const geom = makeTriangleGeometry()
      const xml = buildModelXml([{
        objectId: 1,
        name: 'triangle',
        geometry: geom,
        matrix: new Matrix4(),
      }])

      const { objects, items } = parseModelXml(xml)
      expect(objects).toHaveLength(1)
      expect(objects[0].objectId).toBe(1)
      expect(objects[0].name).toBe('triangle')
      expect(objects[0].positions).toHaveLength(9) // 3 verts * 3
      expect(objects[0].indices).toHaveLength(3) // 1 tri * 3
      expect(items).toHaveLength(1)
      expect(items[0].objectId).toBe(1)
    })

    it('generates correct XML for multiple objects', () => {
      const tri = makeTriangleGeometry()
      const box = makeBoxGeometry()
      const xml = buildModelXml([
        { objectId: 1, name: 'tri', geometry: tri, matrix: new Matrix4() },
        { objectId: 2, name: 'box', geometry: box, matrix: new Matrix4() },
      ])

      const { objects, items } = parseModelXml(xml)
      expect(objects).toHaveLength(2)
      expect(items).toHaveLength(2)
      expect(objects[0].positions).toHaveLength(9)
      expect(objects[1].positions).toHaveLength(24) // 8 verts * 3
      expect(objects[1].indices).toHaveLength(36) // 12 tris * 3
    })

    it('handles non-indexed geometry', () => {
      const geom = new BufferGeometry()
      const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
      geom.setAttribute('position', new Float32BufferAttribute(positions, 3))

      const xml = buildModelXml([{
        objectId: 1,
        name: 'noindex',
        geometry: geom,
        matrix: new Matrix4(),
      }])

      const { objects } = parseModelXml(xml)
      expect(objects[0].indices).toEqual(new Uint32Array([0, 1, 2]))
    })

    it('escapes XML special characters in names', () => {
      const geom = makeTriangleGeometry()
      const xml = buildModelXml([{
        objectId: 1,
        name: 'test<model>&"name',
        geometry: geom,
        matrix: new Matrix4(),
      }])

      expect(xml).toContain('&lt;')
      expect(xml).toContain('&amp;')
      expect(xml).toContain('&quot;')
      expect(xml).not.toContain('name="test<')
    })
  })
})

// ---------------------------------------------------------------------------
// Tests: Matrix transform roundtrip
// ---------------------------------------------------------------------------

describe('matrix transform roundtrip', () => {
  it('identity matrix survives roundtrip', () => {
    const original = new Matrix4() // identity
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('translation matrix survives roundtrip', () => {
    const original = new Matrix4().makeTranslation(10, -5, 30)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)

    // Verify the actual translation values
    const pos = new Vector3()
    const quat = new Quaternion()
    const scale = new Vector3()
    restored.decompose(pos, quat, scale)
    expect(pos.x).toBeCloseTo(10)
    expect(pos.y).toBeCloseTo(-5)
    expect(pos.z).toBeCloseTo(30)
  })

  it('rotation around Z axis survives roundtrip', () => {
    const angle = Math.PI / 4 // 45 degrees
    const original = new Matrix4().makeRotationZ(angle)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('rotation around X axis survives roundtrip', () => {
    const original = new Matrix4().makeRotationX(Math.PI / 3)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('rotation around Y axis survives roundtrip', () => {
    const original = new Matrix4().makeRotationY(-Math.PI / 6)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('combined rotation + translation survives roundtrip', () => {
    const rotation = new Matrix4().makeRotationZ(Math.PI / 4)
    const translation = new Matrix4().makeTranslation(5, 10, 15)
    const original = translation.multiply(rotation) // T * R

    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('scale matrix survives roundtrip', () => {
    const original = new Matrix4().makeScale(2, 3, 0.5)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)
  })

  it('full TRS (translate + rotate + scale) survives roundtrip', () => {
    // Build from decomposed components like Three.js would
    const mesh = new Mesh()
    mesh.position.set(7, -3, 12)
    mesh.rotation.set(0.5, 1.2, -0.3)
    mesh.scale.set(1.5, 1.5, 1.5)
    mesh.updateMatrixWorld(true)

    const original = mesh.matrixWorld.clone()
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])

    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    expect(matrixClose(original, restored)).toBe(true)

    // Verify decomposed values match
    const pos = new Vector3()
    const quat = new Quaternion()
    const scale = new Vector3()
    restored.decompose(pos, quat, scale)

    expect(pos.x).toBeCloseTo(7)
    expect(pos.y).toBeCloseTo(-3)
    expect(pos.z).toBeCloseTo(12)
    expect(scale.x).toBeCloseTo(1.5)
    expect(scale.y).toBeCloseTo(1.5)
    expect(scale.z).toBeCloseTo(1.5)
  })

  it('rotation direction is NOT inverted (regression test)', () => {
    // This tests the specific bug that was fixed: rotation being transposed
    const angle = Math.PI / 4
    const original = new Matrix4().makeRotationZ(angle)

    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original }])
    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    // Apply both matrices to a test point and compare
    const testPoint = new Vector3(1, 0, 0)
    const originalResult = testPoint.clone().applyMatrix4(original)
    const restoredResult = testPoint.clone().applyMatrix4(restored)

    expect(restoredResult.x).toBeCloseTo(originalResult.x)
    expect(restoredResult.y).toBeCloseTo(originalResult.y)
    expect(restoredResult.z).toBeCloseTo(originalResult.z)

    // Specifically: rotating (1,0,0) by 45° around Z should give (cos45, sin45, 0)
    expect(originalResult.x).toBeCloseTo(Math.cos(angle))
    expect(originalResult.y).toBeCloseTo(Math.sin(angle))
    expect(restoredResult.x).toBeCloseTo(Math.cos(angle))
    expect(restoredResult.y).toBeCloseTo(Math.sin(angle))
  })

  it('multiple objects with different transforms all survive roundtrip', () => {
    const geom = makeTriangleGeometry()
    const m1 = new Matrix4().makeTranslation(10, 0, 0)
    const m2 = new Matrix4().makeRotationZ(Math.PI / 2)
    const m3 = new Matrix4().makeScale(2, 2, 2)

    const xml = buildModelXml([
      { objectId: 1, name: 'a', geometry: geom, matrix: m1 },
      { objectId: 2, name: 'b', geometry: geom, matrix: m2 },
      { objectId: 3, name: 'c', geometry: geom, matrix: m3 },
    ])

    const { items } = parseModelXml(xml)
    expect(items).toHaveLength(3)

    expect(matrixClose(m1, parseTransform(items[0].transform))).toBe(true)
    expect(matrixClose(m2, parseTransform(items[1].transform))).toBe(true)
    expect(matrixClose(m3, parseTransform(items[2].transform))).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: Specification-level encode/decode (NOT roundtrip)
// These tests verify correctness against the 3MF spec independently,
// rather than relying on our own encode↔decode being complementary.
// ---------------------------------------------------------------------------

describe('3MF spec compliance — encode', () => {
  /**
   * Helper: extract the transform attribute string from buildModelXml output.
   * Tests the ENCODER independently without going through our decoder.
   */
  function getTransformString(matrix) {
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix }])
    const match = xml.match(/transform="([^"]+)"/)
    return match[1].split(/\s+/).map(Number)
  }

  it('y rotation: encode produces correct 3MF values per spec', () => {
    // Three.js makeRotationY(θ) column-major elements:
    //   col0: [cosθ, 0, -sinθ, 0]
    //   col1: [0, 1, 0, 0]
    //   col2: [sinθ, 0, cosθ, 0]
    //   col3: [0, 0, 0, 1]
    //
    // 3MF row-vector convention: M_3mf = transpose(M_threejs)
    // So 3MF 12 values (row by row):
    //   row0: cosθ, 0, -sinθ    (= Three.js col0)
    //   row1: 0,    1,  0       (= Three.js col1)
    //   row2: sinθ, 0,  cosθ    (= Three.js col2)
    //   row3: 0,    0,  0       (translation = 0)
    const angle = Math.PI / 4
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const m = new Matrix4().makeRotationY(angle)

    const v = getTransformString(m)
    // Row 0
    expect(v[0]).toBeCloseTo(cos) // m00
    expect(v[1]).toBeCloseTo(0) // m01
    expect(v[2]).toBeCloseTo(-sin) // m02
    // Row 1
    expect(v[3]).toBeCloseTo(0) // m10
    expect(v[4]).toBeCloseTo(1) // m11
    expect(v[5]).toBeCloseTo(0) // m12
    // Row 2
    expect(v[6]).toBeCloseTo(sin) // m20
    expect(v[7]).toBeCloseTo(0) // m21
    expect(v[8]).toBeCloseTo(cos) // m22
    // Row 3 (translation)
    expect(v[9]).toBeCloseTo(0) // m30
    expect(v[10]).toBeCloseTo(0) // m31
    expect(v[11]).toBeCloseTo(0) // m32
  })

  it('z rotation: sign of sin is correct (catches inversion bug)', () => {
    // Z rotation 90°: point (1,0,0) → (0,1,0) (counter-clockwise in XY plane)
    // Three.js makeRotationZ(π/2) column-major:
    //   col0: [0, 1, 0, 0]   (cos=0, sin=1)
    //   col1: [-1, 0, 0, 0]
    //   col2: [0, 0, 1, 0]
    //   col3: [0, 0, 0, 1]
    // 3MF rows = Three.js cols:
    //   row0: 0, 1, 0      row1: -1, 0, 0      row2: 0, 0, 1
    const m = new Matrix4().makeRotationZ(Math.PI / 2)
    const v = getTransformString(m)

    expect(v[0]).toBeCloseTo(0) // m00 = cos
    expect(v[1]).toBeCloseTo(1) // m01 = sin  ← THIS is the key: must be +sin, not -sin
    expect(v[2]).toBeCloseTo(0)
    expect(v[3]).toBeCloseTo(-1) // m10 = -sin ← must be -sin, not +sin
    expect(v[4]).toBeCloseTo(0) // m11 = cos
  })

  it('translation appears in last row (3MF row 3), not last column', () => {
    const m = new Matrix4().makeTranslation(10, 20, 30)
    const v = getTransformString(m)
    // 3MF: translation is in the last row (v[9], v[10], v[11])
    expect(v[9]).toBeCloseTo(10)
    expect(v[10]).toBeCloseTo(20)
    expect(v[11]).toBeCloseTo(30)
    // The 3x3 rotation part should be identity
    expect(v[0]).toBeCloseTo(1)
    expect(v[4]).toBeCloseTo(1)
    expect(v[8]).toBeCloseTo(1)
  })
})

describe('3MF spec compliance — decode', () => {
  it('known 3MF transform string produces correct Matrix4', () => {
    // 3MF Z rotation 90° + translation (10, 20, 30):
    // Row 0: cos(90)=0, sin(90)=1, 0
    // Row 1: -sin(90)=-1, cos(90)=0, 0
    // Row 2: 0, 0, 1
    // Row 3: 10, 20, 30
    const transform = '0 1 0 -1 0 0 0 0 1 10 20 30'
    const m = parseTransform(transform)

    // Three.js Matrix4 = transpose(3MF matrix), column-major storage
    // Expected Matrix4 (row-major view):
    //   | 0  -1  0  10 |
    //   | 1   0  0  20 |
    //   | 0   0  1  30 |
    //   | 0   0  0   1 |
    // Column-major elements: [0, 1, 0, 0,  -1, 0, 0, 0,  0, 0, 1, 0,  10, 20, 30, 1]
    const e = m.elements
    expect(e[0]).toBeCloseTo(0) // col0 row0
    expect(e[1]).toBeCloseTo(1) // col0 row1
    expect(e[4]).toBeCloseTo(-1) // col1 row0
    expect(e[5]).toBeCloseTo(0) // col1 row1
    expect(e[10]).toBeCloseTo(1) // col2 row2
    expect(e[12]).toBeCloseTo(10) // translation x
    expect(e[13]).toBeCloseTo(20) // translation y
    expect(e[14]).toBeCloseTo(30) // translation z
    expect(e[15]).toBeCloseTo(1) // homogeneous

    // Semantic check: apply to point (1,0,0) → should give (10, 21, 30)
    // (rotated: (0,1,0), then translated: (10, 21, 30))
    const p = new Vector3(1, 0, 0).applyMatrix4(m)
    expect(p.x).toBeCloseTo(10)
    expect(p.y).toBeCloseTo(21) // 1*sin(90) + 20 = 1 + 20
    expect(p.z).toBeCloseTo(30)
  })

  it('identity 3MF transform string produces identity Matrix4', () => {
    const m = parseTransform('1 0 0 0 1 0 0 0 1 0 0 0')
    const identity = new Matrix4()
    expect(matrixClose(m, identity)).toBe(true)
  })
})

describe('semantic rotation tests — point transformations', () => {
  it('positive Z rotation moves (1,0,0) counter-clockwise in XY plane', () => {
    // This is THE test that catches rotation inversion:
    // Rotating (1,0,0) by +45° around Z should give (cos45, sin45, 0)
    // If the encode is wrong (transposed), we'd get (cos45, -sin45, 0) — INVERTED
    const angle = Math.PI / 4
    const m = new Matrix4().makeRotationZ(angle)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: m }])
    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    const result = new Vector3(1, 0, 0).applyMatrix4(restored)
    expect(result.x).toBeCloseTo(Math.cos(angle))
    expect(result.y).toBeCloseTo(Math.sin(angle)) // MUST be positive, not negative
    expect(result.z).toBeCloseTo(0)
  })

  it('positive Y rotation moves (1,0,0) towards +Z', () => {
    // R_Y(90°) * (1,0,0) = (0, 0, -1) in Three.js convention
    const m = new Matrix4().makeRotationY(Math.PI / 2)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: m }])
    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    const result = new Vector3(1, 0, 0).applyMatrix4(restored)
    expect(result.x).toBeCloseTo(0)
    expect(result.y).toBeCloseTo(0)
    expect(result.z).toBeCloseTo(-1) // Must be -1 not +1 (right-hand rule)
  })

  it('combined rotation: multiple axes, verify all point transforms', () => {
    const mesh = new Mesh()
    mesh.rotation.set(0.5, 1.2, -0.3) // arbitrary rotation
    mesh.position.set(10, 20, 30)
    mesh.updateMatrixWorld(true)

    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: mesh.matrixWorld }])
    const { items } = parseModelXml(xml)
    const restored = parseTransform(items[0].transform)

    // Transform multiple test points with both original and restored matrices
    const testPoints = [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(-1, 2, 3),
      new Vector3(5, -7, 0.5),
    ]

    for (const p of testPoints) {
      const expected = p.clone().applyMatrix4(mesh.matrixWorld)
      const actual = p.clone().applyMatrix4(restored)
      expect(actual.x).toBeCloseTo(expected.x, 5)
      expect(actual.y).toBeCloseTo(expected.y, 5)
      expect(actual.z).toBeCloseTo(expected.z, 5)
    }
  })
})

describe('euler JSON path (actual project file load path)', () => {
  it('euler → JSON → Euler preserves rotation exactly', () => {
    // This tests the ACTUAL path used when loading our project files
    // (NOT the matrix path — the matrix is only for external 3MF viewers)
    const original = new Mesh()
    original.rotation.set(0.5, 1.2, -0.3)
    original.position.set(5, -3, 12)
    original.scale.set(1.5, 1.5, 1.5)
    original.updateMatrixWorld(true)

    // Simulate save: Euler → JSON (what ProjectWriter does)
    const json = {
      position: { x: original.position.x, y: original.position.y, z: original.position.z },
      rotation: { x: original.rotation.x, y: original.rotation.y, z: original.rotation.z, order: original.rotation.order },
      scale: { x: original.scale.x, y: original.scale.y, z: original.scale.z },
    }

    // Simulate load: JSON → Euler (what ProjectReader does)
    const restored = new Mesh()
    const { position: p, rotation: r, scale: s } = json
    restored.position.set(p.x, p.y, p.z)
    restored.rotation.copy(new Euler(r.x, r.y, r.z, r.order || 'XYZ'))
    restored.scale.set(s.x, s.y, s.z)
    restored.updateMatrixWorld(true)

    // Verify transforms are identical by testing point transformations
    const testPoints = [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(3, -2, 7),
    ]

    for (const pt of testPoints) {
      const expected = pt.clone().applyMatrix4(original.matrixWorld)
      const actual = pt.clone().applyMatrix4(restored.matrixWorld)
      expect(actual.x).toBeCloseTo(expected.x, 10)
      expect(actual.y).toBeCloseTo(expected.y, 10)
      expect(actual.z).toBeCloseTo(expected.z, 10)
    }
  })

  it('non-XYZ rotation order is preserved', () => {
    const original = new Mesh()
    original.rotation.set(0.5, 1.2, -0.3, 'ZYX') // non-default order
    original.updateMatrixWorld(true)

    const json = {
      rotation: { x: original.rotation.x, y: original.rotation.y, z: original.rotation.z, order: original.rotation.order },
    }

    const restored = new Mesh()
    restored.rotation.copy(new Euler(json.rotation.x, json.rotation.y, json.rotation.z, json.rotation.order))
    restored.updateMatrixWorld(true)

    // Same Euler angles with different order → different matrix. Verify preserved correctly.
    expect(restored.rotation.order).toBe('ZYX')
    const p = new Vector3(1, 0, 0)
    const expected = p.clone().applyMatrix4(original.matrixWorld)
    const actual = p.clone().applyMatrix4(restored.matrixWorld)
    expect(actual.x).toBeCloseTo(expected.x, 10)
    expect(actual.y).toBeCloseTo(expected.y, 10)
    expect(actual.z).toBeCloseTo(expected.z, 10)
  })

  it('euler JSON path and matrix path produce the same visual result', () => {
    // Cross-validation: both paths should produce identical transforms
    const original = new Mesh()
    original.position.set(7, -3, 12)
    original.rotation.set(0.5, 1.2, -0.3)
    original.scale.set(2, 2, 2)
    original.updateMatrixWorld(true)

    // Path A: Euler JSON (what our project files use)
    const meshA = new Mesh()
    meshA.position.set(original.position.x, original.position.y, original.position.z)
    meshA.rotation.copy(new Euler(original.rotation.x, original.rotation.y, original.rotation.z, original.rotation.order))
    meshA.scale.set(original.scale.x, original.scale.y, original.scale.z)
    meshA.updateMatrixWorld(true)

    // Path B: 3MF matrix encode → decode → decompose (what external 3MF uses)
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{ objectId: 1, name: 't', geometry: geom, matrix: original.matrixWorld }])
    const { items } = parseModelXml(xml)
    const restoredMatrix = parseTransform(items[0].transform)
    const meshB = new Mesh()
    restoredMatrix.decompose(meshB.position, meshB.quaternion, meshB.scale)
    meshB.updateMatrixWorld(true)

    // Both paths should produce identical point transforms
    const testPoints = [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(5, -3, 2),
    ]

    for (const p of testPoints) {
      const a = p.clone().applyMatrix4(meshA.matrixWorld)
      const b = p.clone().applyMatrix4(meshB.matrixWorld)
      expect(b.x).toBeCloseTo(a.x, 4)
      expect(b.y).toBeCloseTo(a.y, 4)
      expect(b.z).toBeCloseTo(a.z, 4)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: Vertex data roundtrip
// ---------------------------------------------------------------------------

describe('vertex data roundtrip', () => {
  it('triangle vertices survive XML roundtrip exactly', () => {
    const geom = makeTriangleGeometry()
    const originalPositions = new Float32Array(geom.attributes.position.array)
    const originalIndices = new Uint32Array(geom.index.array)

    const xml = buildModelXml([{
      objectId: 1,
      name: 'tri',
      geometry: geom,
      matrix: new Matrix4(),
    }])

    const { objects } = parseModelXml(xml)
    expect(objects[0].positions).toEqual(originalPositions)
    expect(objects[0].indices).toEqual(originalIndices)
  })

  it('box vertices survive XML roundtrip exactly', () => {
    const geom = makeBoxGeometry()
    const originalPositions = new Float32Array(geom.attributes.position.array)
    const originalIndices = new Uint32Array(geom.index.array)

    const xml = buildModelXml([{
      objectId: 1,
      name: 'box',
      geometry: geom,
      matrix: new Matrix4(),
    }])

    const { objects } = parseModelXml(xml)
    expect(objects[0].positions).toEqual(originalPositions)
    expect(objects[0].indices).toEqual(originalIndices)
  })

  it('large geometry with many vertices survives roundtrip', () => {
    const vertCount = 999 // must be divisible by 3 (triangles)
    const positions = new Float32Array(vertCount * 3)
    for (let i = 0; i < positions.length; i++) {
      positions[i] = (Math.random() - 0.5) * 200
    }
    const indices = new Uint32Array(vertCount) // vertCount / 3 triangles
    for (let i = 0; i < vertCount; i++) indices[i] = i

    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geom.setIndex(new Uint32BufferAttribute(indices, 1))

    const xml = buildModelXml([{
      objectId: 1,
      name: 'large',
      geometry: geom,
      matrix: new Matrix4(),
    }])

    const { objects } = parseModelXml(xml)
    expect(objects[0].positions.length).toBe(vertCount * 3)
    expect(objects[0].indices.length).toBe(vertCount)

    // Verify values match (Float32 precision)
    for (let i = 0; i < positions.length; i++) {
      expect(objects[0].positions[i]).toBeCloseTo(positions[i], 4)
    }
  })
})

// ---------------------------------------------------------------------------
// Tests: Full 3MF ZIP roundtrip
// ---------------------------------------------------------------------------

describe('3MF ZIP roundtrip', () => {
  it('creates a valid ZIP with all required files', async () => {
    const geom = makeTriangleGeometry()
    const zip = new JSZip()
    zip.file('[Content_Types].xml', buildContentTypes())
    zip.folder('_rels').file('.rels', buildRels())
    zip.folder('3D').file('3dmodel.model', buildModelXml([{
      objectId: 1,
      name: 'test',
      geometry: geom,
      matrix: new Matrix4(),
    }]))
    zip.folder('Metadata').file('ds-project.json', JSON.stringify({ version: 1 }))

    const blob = await zip.generateAsync({ type: 'arraybuffer' })
    const loaded = await JSZip.loadAsync(blob)

    expect(loaded.file('[Content_Types].xml')).not.toBeNull()
    expect(loaded.file('_rels/.rels')).not.toBeNull()
    expect(loaded.file('3D/3dmodel.model')).not.toBeNull()
    expect(loaded.file('Metadata/ds-project.json')).not.toBeNull()
  })

  it('model XML survives ZIP compression roundtrip', async () => {
    const geom = makeBoxGeometry()
    const mesh = new Mesh()
    mesh.position.set(5, 10, 15)
    mesh.rotation.set(0.1, 0.2, 0.3)
    mesh.updateMatrixWorld(true)

    const xmlBefore = buildModelXml([{
      objectId: 1,
      name: 'box',
      geometry: geom,
      matrix: mesh.matrixWorld,
    }])

    // Compress
    const zip = new JSZip()
    zip.folder('3D').file('3dmodel.model', xmlBefore)
    const compressed = await zip.generateAsync({
      type: 'arraybuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    })

    // Decompress
    const loaded = await JSZip.loadAsync(compressed)
    const xmlAfter = await loaded.file('3D/3dmodel.model').async('string')

    expect(xmlAfter).toBe(xmlBefore)
  })

  it('ds-project.json survives ZIP roundtrip', async () => {
    const projectData = {
      version: 1,
      createdAt: '2026-03-09T00:00:00Z',
      models: [
        {
          objectId: 1,
          name: 'tooth.stl',
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0.1, y: 0.2, z: 0.3, order: 'XYZ' },
          scale: { x: 1, y: 1, z: 1 },
          userData: { hollowed: true, orthoProcessed: false },
        },
      ],
      drillState: { parameters: { cylinderRadius: 1.5, cylinderLength: 30, cylinderSegments: 20 } },
      hollowState: { parameters: { operation: 'erosion', voxelSize: 1.0, radius: 2.0 } },
      supportState: { config: { pad_enable: true }, hasSupportMesh: false },
      slicingParams: { profile: { machineName: 'test_printer' } },
      camera: { position: { x: 0, y: -100, z: 50 }, target: { x: 0, y: 0, z: 0 } },
      ui: { controlMode: 'drag', viewMode: 'normal' },
    }

    const zip = new JSZip()
    zip.folder('Metadata').file('ds-project.json', JSON.stringify(projectData))
    const compressed = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })

    const loaded = await JSZip.loadAsync(compressed)
    const jsonStr = await loaded.file('Metadata/ds-project.json').async('string')
    const restored = JSON.parse(jsonStr)

    expect(restored).toEqual(projectData)
    expect(restored.models[0].position).toEqual({ x: 1, y: 2, z: 3 })
    expect(restored.models[0].rotation).toEqual({ x: 0.1, y: 0.2, z: 0.3, order: 'XYZ' })
    expect(restored.models[0].userData.hollowed).toBe(true)
    expect(restored.drillState.parameters.cylinderRadius).toBe(1.5)
    expect(restored.camera.position).toEqual({ x: 0, y: -100, z: 50 })
  })
})

// ---------------------------------------------------------------------------
// Tests: ProjectReader-style reconstruction
// ---------------------------------------------------------------------------

describe('projectReader reconstruction', () => {
  it('reconstructs mesh position/rotation/scale from ds-project.json', () => {
    const modelData = {
      position: { x: 5, y: -3, z: 12 },
      rotation: { x: 0.5, y: 1.2, z: -0.3, order: 'XYZ' },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    }

    const mesh = new Mesh(makeTriangleGeometry(), new MeshBasicMaterial())

    // Apply like ProjectReader does (direct from JSON)
    mesh.position.set(modelData.position.x, modelData.position.y, modelData.position.z)
    mesh.rotation.copy(new Euler(
      modelData.rotation.x,
      modelData.rotation.y,
      modelData.rotation.z,
      modelData.rotation.order,
    ))
    mesh.scale.set(modelData.scale.x, modelData.scale.y, modelData.scale.z)

    expect(mesh.position.x).toBeCloseTo(5)
    expect(mesh.position.y).toBeCloseTo(-3)
    expect(mesh.position.z).toBeCloseTo(12)
    expect(mesh.rotation.x).toBeCloseTo(0.5)
    expect(mesh.rotation.y).toBeCloseTo(1.2)
    expect(mesh.rotation.z).toBeCloseTo(-0.3)
    expect(mesh.rotation.order).toBe('XYZ')
    expect(mesh.scale.x).toBeCloseTo(1.5)
  })

  it('reconstructs mesh from matrix decompose for external 3MF (no ds-project.json)', () => {
    // Simulate: external 3MF with only matrix, no JSON
    const originalMesh = new Mesh()
    originalMesh.position.set(7, -3, 12)
    originalMesh.rotation.set(0.5, 1.2, -0.3)
    originalMesh.scale.set(2, 2, 2)
    originalMesh.updateMatrixWorld(true)

    // Write to 3MF XML
    const geom = makeTriangleGeometry()
    const xml = buildModelXml([{
      objectId: 1,
      name: 'ext',
      geometry: geom,
      matrix: originalMesh.matrixWorld,
    }])

    // Read back
    const { items } = parseModelXml(xml)
    const restoredMatrix = parseTransform(items[0].transform)

    // Decompose (like ProjectReader does for external 3MF)
    const restoredMesh = new Mesh(makeTriangleGeometry(), new MeshBasicMaterial())
    restoredMatrix.decompose(restoredMesh.position, restoredMesh.quaternion, restoredMesh.scale)

    expect(restoredMesh.position.x).toBeCloseTo(7, 4)
    expect(restoredMesh.position.y).toBeCloseTo(-3, 4)
    expect(restoredMesh.position.z).toBeCloseTo(12, 4)
    expect(restoredMesh.scale.x).toBeCloseTo(2, 4)
    expect(restoredMesh.scale.y).toBeCloseTo(2, 4)
    expect(restoredMesh.scale.z).toBeCloseTo(2, 4)

    // Verify the visual result matches: apply both matrices to test points
    originalMesh.updateMatrixWorld(true)
    restoredMesh.updateMatrixWorld(true)

    const testPoints = [
      new Vector3(1, 0, 0),
      new Vector3(0, 1, 0),
      new Vector3(0, 0, 1),
      new Vector3(1, 1, 1),
    ]

    for (const p of testPoints) {
      const a = p.clone().applyMatrix4(originalMesh.matrixWorld)
      const b = p.clone().applyMatrix4(restoredMesh.matrixWorld)
      expect(b.x).toBeCloseTo(a.x, 3)
      expect(b.y).toBeCloseTo(a.y, 3)
      expect(b.z).toBeCloseTo(a.z, 3)
    }
  })

  it('userData flags are preserved through save/load', () => {
    const modelData = {
      userData: { hollowed: true, orthoProcessed: true, shapeParams: null },
    }

    const mesh = new Mesh(makeTriangleGeometry(), new MeshBasicMaterial())
    mesh.userData = { ...mesh.userData, ...modelData.userData }

    expect(mesh.userData.hollowed).toBe(true)
    expect(mesh.userData.orthoProcessed).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Tests: End-to-end (simulated ProjectWriter → ProjectReader)
// ---------------------------------------------------------------------------

describe('end-to-end save/load simulation', () => {
  it('complete roundtrip: build scene → write 3MF → read 3MF → verify', async () => {
    // Build a scene with 2 models at different transforms
    const model1 = new Mesh(makeTriangleGeometry(), new MeshBasicMaterial())
    model1.name = 'tooth.stl'
    model1.position.set(5, 10, 3)
    model1.rotation.set(0, 0, Math.PI / 4)
    model1.userData = { hollowed: true, orthoProcessed: false }
    model1.updateMatrixWorld(true)

    const model2 = new Mesh(makeBoxGeometry(), new MeshBasicMaterial())
    model2.name = 'base.stl'
    model2.position.set(-10, 0, 0)
    model2.scale.set(2, 2, 2)
    model2.userData = { hollowed: false, orthoProcessed: true }
    model2.updateMatrixWorld(true)

    const models = [model1, model2]

    // === WRITE ===
    const xmlObjects = models.map((m, i) => ({
      objectId: i + 1,
      name: m.name,
      geometry: m.geometry,
      matrix: m.matrixWorld,
    }))

    const projectJson = {
      version: 1,
      models: models.map((m, i) => ({
        objectId: i + 1,
        name: m.name,
        uuid: m.uuid,
        position: { x: m.position.x, y: m.position.y, z: m.position.z },
        rotation: { x: m.rotation.x, y: m.rotation.y, z: m.rotation.z, order: m.rotation.order },
        scale: { x: m.scale.x, y: m.scale.y, z: m.scale.z },
        userData: { ...m.userData },
      })),
      drillState: { parameters: { cylinderRadius: 1.5 } },
      camera: { position: { x: 0, y: -100, z: 50 }, target: { x: 0, y: 0, z: 0 } },
    }

    const zip = new JSZip()
    zip.file('[Content_Types].xml', buildContentTypes())
    zip.folder('_rels').file('.rels', buildRels())
    zip.folder('3D').file('3dmodel.model', buildModelXml(xmlObjects))
    zip.folder('Metadata').file('ds-project.json', JSON.stringify(projectJson))

    const blob = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })

    // === READ ===
    const loaded = await JSZip.loadAsync(blob)
    const xmlString = await loaded.file('3D/3dmodel.model').async('string')
    const restoredProjectJson = JSON.parse(
      await loaded.file('Metadata/ds-project.json').async('string'),
    )

    const parsedObjects = parseModelXml(xmlString)

    // Verify model count
    expect(parsedObjects.objects).toHaveLength(2)
    expect(restoredProjectJson.models).toHaveLength(2)

    // Verify model 1: position and rotation from JSON
    const m1Data = restoredProjectJson.models[0]
    expect(m1Data.name).toBe('tooth.stl')
    expect(m1Data.position.x).toBeCloseTo(5)
    expect(m1Data.position.y).toBeCloseTo(10)
    expect(m1Data.position.z).toBeCloseTo(3)
    expect(m1Data.rotation.z).toBeCloseTo(Math.PI / 4)
    expect(m1Data.userData.hollowed).toBe(true)
    expect(m1Data.userData.orthoProcessed).toBe(false)

    // Verify model 2: scale
    const m2Data = restoredProjectJson.models[1]
    expect(m2Data.name).toBe('base.stl')
    expect(m2Data.position.x).toBeCloseTo(-10)
    expect(m2Data.scale.x).toBeCloseTo(2)
    expect(m2Data.userData.orthoProcessed).toBe(true)

    // Verify geometry vertex data is preserved
    const originalPositions1 = new Float32Array(model1.geometry.attributes.position.array)
    expect(parsedObjects.objects[0].positions).toEqual(originalPositions1)

    const originalPositions2 = new Float32Array(model2.geometry.attributes.position.array)
    expect(parsedObjects.objects[1].positions).toEqual(originalPositions2)

    // Verify 3MF matrix roundtrip for both models
    const restored1 = parseTransform(parsedObjects.items[0].transform)
    expect(matrixClose(model1.matrixWorld, restored1)).toBe(true)

    const restored2 = parseTransform(parsedObjects.items[1].transform)
    expect(matrixClose(model2.matrixWorld, restored2)).toBe(true)

    // Verify app state
    expect(restoredProjectJson.drillState.parameters.cylinderRadius).toBe(1.5)
    expect(restoredProjectJson.camera.position.z).toBe(50)
  })

  it('external 3MF (no ds-project.json) loads mesh only', async () => {
    const geom = makeTriangleGeometry()
    const matrix = new Matrix4().makeTranslation(10, 20, 30)

    const zip = new JSZip()
    zip.file('[Content_Types].xml', buildContentTypes())
    zip.folder('_rels').file('.rels', buildRels())
    zip.folder('3D').file('3dmodel.model', buildModelXml([{
      objectId: 1,
      name: 'external',
      geometry: geom,
      matrix,
    }]))
    // No Metadata/ds-project.json

    const blob = await zip.generateAsync({ type: 'arraybuffer' })
    const loaded = await JSZip.loadAsync(blob)

    // Verify no project data
    expect(loaded.file('Metadata/ds-project.json')).toBeNull()

    // Verify mesh is still loadable
    const xmlString = await loaded.file('3D/3dmodel.model').async('string')
    const { objects, items } = parseModelXml(xmlString)
    expect(objects).toHaveLength(1)
    expect(objects[0].name).toBe('external')

    // Verify transform
    const restored = parseTransform(items[0].transform)
    const pos = new Vector3()
    restored.decompose(pos, new Quaternion(), new Vector3())
    expect(pos.x).toBeCloseTo(10)
    expect(pos.y).toBeCloseTo(20)
    expect(pos.z).toBeCloseTo(30)
  })
})

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Compare two Matrix4 element-by-element with tolerance */
function matrixClose(a, b, eps = 1e-6) {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(a.elements[i] - b.elements[i]) > eps)
      return false
  }
  return true
}
