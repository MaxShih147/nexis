import { Box3, BoxGeometry, BufferGeometry, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TextEmbossManager } from '../TextEmbossManager'

// ---------------------------------------------------------------------------
// TransformControls stub
// ---------------------------------------------------------------------------

vi.mock('three/examples/jsm/controls/TransformControls.js', () => ({
  TransformControls: class {
    constructor() {
      this.object = null
      this._helper = { visible: false }
      this._listeners = {}
    }

    setMode() {}
    setSpace() {}
    get showX() { return true }
    set showX(_) {}
    get showY() { return true }
    set showY(_) {}
    get showZ() { return true }
    set showZ(_) {}
    getHelper() { return this._helper }

    attach(obj) {
      this.object = obj
      this._helper.visible = true
    }

    detach() {
      this.object = null
      this._helper.visible = false
    }

    addEventListener(type, cb) {
      if (!this._listeners[type])
        this._listeners[type] = []
      this._listeners[type].push(cb)
    }

    dispose() {}
  },
}))

// ---------------------------------------------------------------------------
// Three.js stubs
// ---------------------------------------------------------------------------

function makeFontData(url, glyphs = {}) {
  return {
    glyphs: {
      '?': { ha: 1000, o: 'm 0 0 l 5 0 l 5 5 l 0 5' },
      ...glyphs,
    },
    familyName: url,
    ascender: 1000,
    descender: 0,
    underlinePosition: 0,
    underlineThickness: 0,
    boundingBox: { xMin: 0, xMax: 1000, yMin: 0, yMax: 1000 },
    resolution: 1000,
    original_font_information: {},
  }
}

const loadFontJsonMock = vi.fn((url, onLoad) => {
  onLoad({
    data: makeFontData(url),
    generateShapes: () => [],
  })
})

const loadTtfFontMock = vi.fn((_url, onLoad) => {
  onLoad({
    glyphs: {
      '中': { ha: 1000, o: 'm 0 0 l 10 0 l 10 10 l 0 10' },
      '文': { ha: 1000, o: 'm 0 0 l 10 0 l 10 10 l 0 10' },
      '?': { ha: 1000, o: 'm 0 0 l 10 0 l 10 10 l 0 10' },
    },
    familyName: 'Arial Unicode',
    ascender: 1000,
    descender: 0,
    underlinePosition: 0,
    underlineThickness: 0,
    boundingBox: { xMin: 0, xMax: 1000, yMin: 0, yMax: 1000 },
    resolution: 1000,
    original_font_information: {},
  })
})

vi.mock('three/examples/jsm/loaders/FontLoader.js', () => ({
  FontLoader: class {
    load(_url, onLoad, onProgress, onError) {
      loadFontJsonMock(_url, onLoad, onProgress, onError)
    }
  },
  Font: class {
    constructor(data) {
      this.data = data
    }

    generateShapes() {
      return []
    }
  },
}))

vi.mock('three/examples/jsm/loaders/TTFLoader.js', () => ({
  TTFLoader: class {
    load(_url, onLoad) {
      loadTtfFontMock(_url, onLoad)
    }
  },
}))

vi.mock('three/examples/jsm/geometries/TextGeometry.js', async () => {
  const THREE = await import('three')
  return {
    TextGeometry: class extends THREE.BufferGeometry {
      constructor() {
        super()
        this.boundingBox = new THREE.Box3(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(10, 5, 2),
        )
        this.computeBoundingBox = vi.fn()
        this.translate = vi.fn()
        this.dispose = vi.fn()
      }
    },
  }
})

vi.mock('three/examples/jsm/exporters/STLExporter.js', () => ({
  STLExporter: class {
    parse() {
      return new ArrayBuffer(8)
    }
  },
}))

// ---------------------------------------------------------------------------
// Scene / renderer stubs
// ---------------------------------------------------------------------------
function makeScene() {
  const children = []
  return {
    add: vi.fn(obj => children.push(obj)),
    remove: vi.fn((obj) => {
      const i = children.indexOf(obj)
      if (i !== -1)
        children.splice(i, 1)
    }),
    children,
  }
}

function makeCamera() {
  return {
    position: new Vector3(0, 0, 100),
  }
}

function makeRendererDom() {
  return {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
}

// ---------------------------------------------------------------------------
// Model mesh stub (a simple box-like mesh for raycasting tests)
// ---------------------------------------------------------------------------
function makeModelMesh() {
  const mesh = new Mesh(new BoxGeometry(10, 10, 10), new MeshStandardMaterial())
  mesh.uuid = 'model-uuid'
  mesh.updateMatrixWorld(true)
  return mesh
}

// ---------------------------------------------------------------------------
// Task 4.1 – Surface snapping: text attaches to model surface, disappears off model
// ---------------------------------------------------------------------------
describe('4.1 – Surface snapping', () => {
  let manager, scene, camera, domElement, modelMesh

  beforeEach(() => {
    vi.clearAllMocks()
    scene = makeScene()
    camera = makeCamera()
    domElement = makeRendererDom()
    modelMesh = makeModelMesh()
    manager = new TextEmbossManager({ scene, camera, domElement })
  })

  it('shows text mesh when mouse hits model surface', async () => {
    await manager.generatePreview('Test', 10, 2)

    // Simulate a raycasting hit on the model
    const hitPoint = new Vector3(5, 5, 10)
    const hitNormal = new Vector3(0, 0, 1)
    manager._applySnapPosition(hitPoint, hitNormal)

    expect(manager.textMesh).not.toBeNull()
    expect(manager.textMesh.visible).toBe(true)
  })

  it('places the preview on the face that is already facing the user when generated', async () => {
    manager.setTargetMeshes([modelMesh])

    await manager.generatePreview('Test', 10, 2)

    expect(manager.textMesh).not.toBeNull()
    expect(manager.textMesh.visible).toBe(true)
    expect(manager.textMesh.position.z).toBeGreaterThan(0)
  })

  it('loads TC, JP, and SC JSON fonts in fallback priority order', async () => {
    await manager.generatePreview('中文', 10, 2)

    expect(loadFontJsonMock).toHaveBeenNthCalledWith(1, '/fonts/noto_sans_tc_regular.typeface.json', expect.any(Function), undefined, expect.any(Function))
    expect(loadFontJsonMock).toHaveBeenNthCalledWith(2, '/fonts/noto_sans_jp_regular.typeface.json', expect.any(Function), undefined, expect.any(Function))
    expect(loadFontJsonMock).toHaveBeenNthCalledWith(3, '/fonts/noto_sans_sc_regular.typeface.json', expect.any(Function), undefined, expect.any(Function))
    expect(loadTtfFontMock).not.toHaveBeenCalled()
  })

  it('merges glyphs using TC before JP before SC', () => {
    const tcGlyph = { ha: 1, o: 'tc' }
    const jpGlyph = { ha: 2, o: 'jp' }
    const scGlyph = { ha: 3, o: 'sc' }
    const font = manager._mergeFontsForFallback([
      { data: makeFontData('tc', { shared: tcGlyph }) },
      { data: makeFontData('jp', { shared: jpGlyph, jpOnly: jpGlyph }) },
      { data: makeFontData('sc', { shared: scGlyph, scOnly: scGlyph }) },
    ])

    expect(font.data.glyphs.shared).toBe(tcGlyph)
    expect(font.data.glyphs.jpOnly).toBe(jpGlyph)
    expect(font.data.glyphs.scOnly).toBe(scGlyph)
  })

  it('aliases compatibility glyph keys so 乙 does not fall back to ?', () => {
    const radicalGlyph = { ha: 1000, o: 'm 0 0 l 10 0 l 10 10 l 0 10' }
    const font = {
      data: {
        glyphs: {
          '⼄': radicalGlyph,
          '?': { ha: 1000, o: 'm 0 0 l 5 0 l 5 5 l 0 5' },
        },
      },
    }

    manager._installCompatibilityGlyphAliases(font)

    expect(font.data.glyphs['乙']).toBe(radicalGlyph)
  })

  it('does not alias keys whose NFKC decomposition spans multiple code points', () => {
    // U+FB00 ﬀ → NFKC → "ff" (2 code points) — must not become a glyph key.
    const ligatureGlyph = { ha: 600, o: 'm 0 0 l 6 0 l 6 6 l 0 6' }
    const font = {
      data: {
        glyphs: {
          'ﬀ': ligatureGlyph,
          '?': { ha: 1000, o: 'm 0 0 l 5 0 l 5 5 l 0 5' },
        },
      },
    }

    manager._installCompatibilityGlyphAliases(font)

    expect(font.data.glyphs.ff).toBeUndefined()
    expect(font.data.glyphs.f).toBeUndefined()
    expect(Object.keys(font.data.glyphs)).toEqual(['ﬀ', '?'])
  })

  it('prefers a later-priority real glyph over an earlier-priority Kangxi alias', async () => {
    const tcKangxi = { ha: 1000, o: 'tc-kangxi' }
    const jpReal = { ha: 1000, o: 'jp-real' }
    loadFontJsonMock.mockReset()
    loadFontJsonMock
      .mockImplementationOnce((url, onLoad) => onLoad({
        data: makeFontData(url, { '⼄': tcKangxi }), // TC: only Kangxi form
      }))
      .mockImplementationOnce((url, onLoad) => onLoad({
        data: makeFontData(url, { 乙: jpReal }), // JP: real 乙
      }))
      .mockImplementationOnce((url, onLoad) => onLoad({
        data: makeFontData(url), // SC: neither
      }))

    await manager._ensureFontLoaded()

    expect(manager._font.data.glyphs['乙']).toBe(jpReal)
    expect(manager._font.data.glyphs['⼄']).toBe(tcKangxi)
  })

  it('logs and rejects when any font in the fallback chain fails to load', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const loadError = new Error('404 not found')
    loadFontJsonMock.mockReset()
    loadFontJsonMock
      .mockImplementationOnce((url, onLoad) => onLoad({ data: makeFontData(url), generateShapes: () => [] }))
      .mockImplementationOnce((_url, _onLoad, _onProgress, onError) => onError(loadError))
      .mockImplementationOnce((url, onLoad) => onLoad({ data: makeFontData(url), generateShapes: () => [] }))

    await expect(manager._ensureFontLoaded()).rejects.toBe(loadError)
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TextEmbossManager] font load failed:',
      '/fonts/noto_sans_jp_regular.typeface.json',
      loadError,
    )

    consoleErrorSpy.mockRestore()
  })

  it('hides text mesh when mouse leaves model (no intersection)', async () => {
    await manager.generatePreview('Test', 10, 2)

    // First snap to a position
    manager._applySnapPosition(new Vector3(5, 5, 10), new Vector3(0, 0, 1))
    expect(manager.textMesh.visible).toBe(true)

    // Then simulate leaving the model
    manager._onNoIntersection()

    expect(manager.textMesh.visible).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Task 4.3 – Snap offset: text midpoint sits on the hit surface
// ---------------------------------------------------------------------------
describe('4.3 – Snap offset along inverted normal', () => {
  let manager, scene

  beforeEach(() => {
    scene = makeScene()
    manager = new TextEmbossManager({ scene, camera: makeCamera(), domElement: makeRendererDom() })
  })

  it('applies only a small inward offset along the inverted surface normal when snapping', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitPoint = new Vector3(0, 0, 10)
    const hitNormal = new Vector3(0, 0, 1) // pointing up in Z

    manager._applySnapPosition(hitPoint, hitNormal)

    const pos = manager.textMesh.position
    expect(pos.z).toBeCloseTo(hitPoint.z - 0.1, 5)
  })

  it('offset is in the direction opposite to the surface normal', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitPoint = new Vector3(0, 10, 0)
    const hitNormal = new Vector3(0, 1, 0) // pointing up in Y

    manager._applySnapPosition(hitPoint, hitNormal)

    const pos = manager.textMesh.position
    expect(pos.y).toBeCloseTo(hitPoint.y - 0.1, 5)
  })

  it('offset remains the small inset after geometry is centered on Z', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitPoint = new Vector3(0, 0, 5)
    const hitNormal = new Vector3(0, 0, 1)

    manager._applySnapPosition(hitPoint, hitNormal)

    const offset = hitPoint.z - manager.textMesh.position.z
    expect(offset).toBeCloseTo(0.1, 5)
  })

  it('keeps the same inset when text depth changes because Z-centering handles thickness', async () => {
    await manager.generatePreview('Test', 10, 4)

    const hitPoint = new Vector3(0, 0, 5)
    const hitNormal = new Vector3(0, 0, 1)

    manager._applySnapPosition(hitPoint, hitNormal)

    const offset = hitPoint.z - manager.textMesh.position.z
    expect(offset).toBeCloseTo(0.1, 5)
  })

  it('translates text geometry by the bounding-box Z center', async () => {
    const geometry = new BufferGeometry()
    geometry.boundingBox = new Box3(new Vector3(0, 0, 0), new Vector3(10, 5, 2))
    vi.spyOn(geometry, 'computeBoundingBox').mockImplementation(() => {})
    vi.spyOn(geometry, 'translate')
    vi.spyOn(geometry, 'scale')
    vi.spyOn(manager, '_buildExtrudedGeometryFromShapes').mockReturnValue(geometry)

    await manager.generatePreview('Test', 10, 4)

    expect(manager.textMesh.geometry.translate).toHaveBeenCalledWith(-5, -2.5, -1)
  })

  it('scales text geometry down when its longest edge exceeds 20mm', () => {
    const manager = new TextEmbossManager({
      scene: makeScene(),
      camera: makeCamera(),
      domElement: makeRendererDom(),
    })
    const geometry = {
      boundingBox: {
        getSize: target => target.set(30, 10, 2),
      },
      computeBoundingBox: vi.fn(),
      scale: vi.fn(),
    }

    manager._limitGeometryLongestEdge(geometry)

    expect(geometry.scale).toHaveBeenCalledWith(20 / 30, 20 / 30, 20 / 30)
  })
})

// ---------------------------------------------------------------------------
// Task 4.5 – Snap rotation: aligns to surface normal, no yaw/roll around text face normal
// ---------------------------------------------------------------------------
describe('4.5 – Snap rotation constraints', () => {
  let manager

  beforeEach(() => {
    manager = new TextEmbossManager({
      scene: makeScene(),
      camera: makeCamera(),
      domElement: makeRendererDom(),
    })
  })

  it('aligns text mesh forward axis to surface normal after snapping', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(0, 1, 0).normalize() // Y-up normal
    manager._applySnapPosition(new Vector3(0, 0, 0), hitNormal)

    // The text mesh should be oriented so its local Z (or forward) points along hitNormal
    const meshForward = new Vector3(0, 0, 1).applyQuaternion(manager.textMesh.quaternion)
    // Dot product close to 1 means aligned
    expect(Math.abs(meshForward.dot(hitNormal))).toBeGreaterThan(0.99)
  })

  it('produces the same rotation for the same normal regardless of call order', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(1, 1, 0).normalize()

    manager._applySnapPosition(new Vector3(0, 0, 0), hitNormal)
    const q1 = manager.textMesh.quaternion.clone()

    manager._applySnapPosition(new Vector3(5, 5, 5), hitNormal)
    const q2 = manager.textMesh.quaternion.clone()

    // Same normal → same orientation (no yaw drift)
    expect(q1.dot(q2)).toBeCloseTo(1, 5)
  })

  it('does not apply any rotation around the text forward axis (no yaw/roll self-rotation)', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(0, 0, 1).normalize()
    manager._applySnapPosition(new Vector3(0, 0, 0), hitNormal)

    // Extract the rotation around the text's forward axis (Z in local space)
    // If yaw=0, applying the inverse quaternion to world up should not have rotational offset
    const worldUp = new Vector3(0, 1, 0)
    const localUp = worldUp.clone().applyQuaternion(manager.textMesh.quaternion.clone().invert())

    // The local up should only be a rotation in the plane perpendicular to forward
    // (no roll): localUp.z should be near 0
    expect(Math.abs(localUp.z)).toBeLessThan(0.01)
  })

  it('keeps text upright relative to world up on the right-facing surface', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(1, 0, 0)
    manager._applySnapPosition(new Vector3(0, 0, 0), hitNormal)

    const meshForward = new Vector3(0, 0, 1).applyQuaternion(manager.textMesh.quaternion)
    const meshUp = new Vector3(0, 1, 0).applyQuaternion(manager.textMesh.quaternion)

    expect(meshForward.distanceTo(hitNormal)).toBeLessThan(0.0001)
    expect(meshUp.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(0.0001)
  })

  it('keeps text upright relative to world up on the left-facing surface', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(-1, 0, 0)
    manager._applySnapPosition(new Vector3(0, 0, 0), hitNormal)

    const meshForward = new Vector3(0, 0, 1).applyQuaternion(manager.textMesh.quaternion)
    const meshUp = new Vector3(0, 1, 0).applyQuaternion(manager.textMesh.quaternion)

    expect(meshForward.distanceTo(hitNormal)).toBeLessThan(0.0001)
    expect(meshUp.distanceTo(new Vector3(0, 0, 1))).toBeLessThan(0.0001)
  })
})

// ---------------------------------------------------------------------------
// Task 4.9 – _getHitNormal returns world-space normal after gizmo rotation
// ---------------------------------------------------------------------------
describe('4.9 – _getHitNormal returns world-space normal after gizmo rotation', () => {
  let manager

  beforeEach(() => {
    manager = new TextEmbossManager({
      scene: makeScene(),
      camera: makeCamera(),
      domElement: makeRendererDom(),
    })
  })

  it('transforms intersection.normal (vertex path) to world space using object matrixWorld', () => {
    // Mesh rotated 90° around Y: local +Z maps to world +X
    const rotatedMesh = { matrixWorld: new Matrix4().makeRotationY(Math.PI / 2) }
    const intersection = {
      normal: new Vector3(0, 0, 1), // local +Z
      face: null,
      object: rotatedMesh,
    }

    const result = manager._getHitNormal(intersection)

    expect(result.x).toBeCloseTo(1, 4)
    expect(result.y).toBeCloseTo(0, 4)
    expect(result.z).toBeCloseTo(0, 4)
  })

  it('transforms face.normal (face path) to world space using object matrixWorld', () => {
    // Same rotation — verifies both paths behave identically
    const rotatedMesh = { matrixWorld: new Matrix4().makeRotationY(Math.PI / 2) }
    const intersection = {
      normal: undefined,
      face: { normal: new Vector3(0, 0, 1) }, // local +Z
      object: rotatedMesh,
    }

    const result = manager._getHitNormal(intersection)

    expect(result.x).toBeCloseTo(1, 4)
    expect(result.y).toBeCloseTo(0, 4)
    expect(result.z).toBeCloseTo(0, 4)
  })

  it('intersection.normal and face.normal return identical world-space result for the same local normal', () => {
    const rotatedMesh = { matrixWorld: new Matrix4().makeRotationY(Math.PI / 4) }
    const localNormal = new Vector3(0, 0, 1)

    const viaVertexNormal = manager._getHitNormal({
      normal: localNormal.clone(),
      face: null,
      object: rotatedMesh,
    })
    const viaFaceNormal = manager._getHitNormal({
      normal: undefined,
      face: { normal: localNormal.clone() },
      object: rotatedMesh,
    })

    expect(viaVertexNormal.x).toBeCloseTo(viaFaceNormal.x, 5)
    expect(viaVertexNormal.y).toBeCloseTo(viaFaceNormal.y, 5)
    expect(viaVertexNormal.z).toBeCloseTo(viaFaceNormal.z, 5)
  })

  it('returns (0,0,1) fallback when intersection has no normal data', () => {
    const rotatedMesh = { matrixWorld: new Matrix4().makeRotationY(Math.PI / 2) }
    const intersection = { normal: undefined, face: null, object: rotatedMesh }

    const result = manager._getHitNormal(intersection)

    expect(result.x).toBeCloseTo(0, 4)
    expect(result.y).toBeCloseTo(0, 4)
    expect(result.z).toBeCloseTo(1, 4)
  })

  it('text mesh +Z aligns to world-space normal after _applySnapPosition with rotated mesh intersection', async () => {
    await manager.generatePreview('Test', 10, 2)

    // Simulates a hit on a model rotated 90° around Y:
    // the face pointing local +Z now points world +X
    const rotatedMesh = { matrixWorld: new Matrix4().makeRotationY(Math.PI / 2) }
    const worldSpaceNormal = manager._getHitNormal({
      normal: new Vector3(0, 0, 1), // local +Z of rotated mesh
      face: null,
      object: rotatedMesh,
    })
    manager._applySnapPosition(new Vector3(0, 0, 0), worldSpaceNormal)

    const meshForward = new Vector3(0, 0, 1).applyQuaternion(manager.textMesh.quaternion)
    expect(meshForward.x).toBeCloseTo(1, 4)
    expect(meshForward.y).toBeCloseTo(0, 4)
    expect(meshForward.z).toBeCloseTo(0, 4)
  })
})

// ---------------------------------------------------------------------------
// Task 4.7 – Position confirmation: click locks text, re-click moves text
// ---------------------------------------------------------------------------
describe('4.7 – Position confirmation', () => {
  let manager

  beforeEach(() => {
    manager = new TextEmbossManager({
      scene: makeScene(),
      camera: makeCamera(),
      domElement: makeRendererDom(),
    })
  })

  it('starts with positionConfirmed = false', () => {
    expect(manager.positionConfirmed).toBe(false)
  })

  it('sets positionConfirmed to true after confirmPosition()', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))

    manager.confirmPosition()

    expect(manager.positionConfirmed).toBe(true)
  })

  it('calls the registered callback when position is confirmed', async () => {
    const cb = vi.fn()
    manager.setPositionConfirmedCallback(cb)

    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    expect(cb).toHaveBeenCalledWith(true)
  })

  it('allows re-confirming a new position when clicked again', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    const firstPos = manager.textMesh.position.clone()

    // Move to new position and re-confirm
    manager._applySnapPosition(new Vector3(10, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    expect(manager.textMesh.position.x).not.toBe(firstPos.x)
    expect(manager.positionConfirmed).toBe(true)
  })

  it('resumes snapping after clearPreview() is called', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    manager.clearPreview()

    expect(manager.positionConfirmed).toBe(false)
    expect(manager.textMesh).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Z-rotation gizmo
// ---------------------------------------------------------------------------
describe('z-rotation gizmo', () => {
  let manager

  beforeEach(() => {
    vi.clearAllMocks()
    manager = new TextEmbossManager({
      scene: makeScene(),
      camera: makeCamera(),
      domElement: makeRendererDom(),
    })
  })

  it('5.1 – resets _userZRotation to 0 on generatePreview()', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._userZRotation = Math.PI / 4

    await manager.generatePreview('New', 10, 2)

    expect(manager._userZRotation).toBe(0)
  })

  it('5.2 – preserves _userZRotation when user re-selects position', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    manager._userZRotation = Math.PI / 4

    // User clicks again to re-select position
    manager._applySnapPosition(new Vector3(5, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    expect(manager._userZRotation).toBe(Math.PI / 4)
  })

  it('5.3 – _applySnapPosition applies _userZRotation on top of surface alignment', async () => {
    await manager.generatePreview('Test', 10, 2)

    const hitNormal = new Vector3(0, 0, 1)

    manager._userZRotation = 0
    manager._applySnapPosition(new Vector3(0, 0, 5), hitNormal)
    const qBase = manager.textMesh.quaternion.clone()

    manager._userZRotation = Math.PI / 4
    manager._applySnapPosition(new Vector3(0, 0, 5), hitNormal)
    const qRotated = manager.textMesh.quaternion.clone()

    // Quaternions should differ (dot product < 1)
    expect(Math.abs(qBase.dot(qRotated))).toBeLessThan(0.99)
  })

  it('5.4 – clearPreview() detaches gizmo (visible=false, object=null)', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()

    // Gizmo should be attached after confirm
    expect(manager._gizmoControls.object).not.toBeNull()

    manager.clearPreview()

    expect(manager._gizmoControls.object).toBeNull()
    expect(manager._gizmoControls._helper.visible).toBe(false)
  })

  it('g-02 – gizmo helper is not visible during snap mode before position is confirmed', async () => {
    await manager.generatePreview('Test', 10, 2)

    expect(manager._gizmoControls._helper.visible).toBe(false)
  })

  it('captures and restores preview state for undo/redo', async () => {
    const emptyState = manager.capturePreviewState()
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()
    manager._userZRotation = Math.PI / 4
    const confirmedState = manager.capturePreviewState()

    manager.restorePreviewState(emptyState)

    expect(manager.textMesh).toBeNull()
    expect(manager.positionConfirmed).toBe(false)
    expect(manager._gizmoControls.object).toBeNull()
    expect(manager._snapping).toBe(false)

    manager.restorePreviewState(confirmedState)

    expect(manager.textMesh).not.toBeNull()
    expect(manager.positionConfirmed).toBe(true)
    expect(manager._gizmoControls.object).toBe(manager.textMesh)
    expect(manager._userZRotation).toBe(Math.PI / 4)
    expect(manager._snapping).toBe(false)
  })

  it('restores non-confirmed preview state with snapping re-enabled', async () => {
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    const snappingState = manager.capturePreviewState()

    // Confirm position, then clear to fully stop snapping
    manager.confirmPosition()
    manager.clearPreview()
    expect(manager._snapping).toBe(false)

    manager.restorePreviewState(snappingState)

    expect(manager.textMesh).not.toBeNull()
    expect(manager.positionConfirmed).toBe(false)
    expect(manager._snapping).toBe(true)
    expect(manager._gizmoControls.object).toBeNull()
  })

  it('capturePreviewState before/after generatePreview produces detectable change for undo', async () => {
    const before = manager.capturePreviewState()
    expect(before.hasPreview).toBe(false)

    await manager.generatePreview('Test', 10, 2)
    const after = manager.capturePreviewState()
    expect(after.hasPreview).toBe(true)

    expect(manager._hasPreviewStateChanged(before, after)).toBe(true)
  })

  it('emits a preview undo callback when pointer down confirms position', async () => {
    const callback = vi.fn()
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.setPreviewUndoCallback(callback)
    manager._getIntersection = vi.fn().mockReturnValue({
      point: new Vector3(1, 2, 3),
      normal: new Vector3(0, 0, 1),
      object: makeModelMesh(),
    })
    manager._getHitNormal = vi.fn().mockReturnValue(new Vector3(0, 0, 1))

    manager._handlePointerDown({ clientX: 0, clientY: 0 })

    expect(callback).toHaveBeenCalledTimes(1)
    const [oldState, newState] = callback.mock.calls[0]
    expect(oldState.positionConfirmed).toBe(false)
    expect(newState.positionConfirmed).toBe(true)
    expect(newState.position).toEqual({ x: 1, y: 2, z: 2.9 })
  })

  it('emits a preview undo callback when gizmo drag release changes rotation', async () => {
    const callback = vi.fn()
    await manager.generatePreview('Test', 10, 2)
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    manager.confirmPosition()
    manager.setPreviewUndoCallback(callback)

    const [onDraggingChanged] = manager._gizmoControls._listeners['dragging-changed']
    onDraggingChanged({ value: true })
    manager._userZRotation = Math.PI / 2
    manager._applySnapPosition(new Vector3(0, 0, 5), new Vector3(0, 0, 1))
    onDraggingChanged({ value: false })

    expect(callback).toHaveBeenCalledTimes(1)
    const [oldState, newState] = callback.mock.calls[0]
    expect(oldState.userZRotation).toBe(0)
    expect(newState.userZRotation).toBe(Math.PI / 2)
  })
})
