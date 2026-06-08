import { PRIMARY_HEX } from '@/constants/theme.js'
import { ArrowHelper, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, MeshLambertMaterial, Quaternion, Vector3 } from 'three'
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry'

const CONVEX_HULL_OFFSET_RATIO = 0.0005
const CONVEX_HULL_OFFSET_MIN = 0.01
const NORMAL_KEY_PRECISION = 4
const NORMAL_KEY_EPSILON = 1e-6
const TARGET_NORMAL_LAY_ON_FACE = new Vector3(0, 0, -1)
const TARGET_NORMAL_FACE_ON_TOP = new Vector3(0, 0, 1)
const FACE_SELECTION_MODES = {
  NONE: 'none',
  LAY_ON_FACE: 'lay-on-face',
  FACE_ON_TOP: 'face-on-top',
}

/**
 * Handles the face selection/lay-on-face interaction logic.
 */
export class FaceSelectionManager {
  constructor(selectionManager, render, modelStore, setToBottom = () => {}) {
    this.selectionManager = selectionManager
    this.render = render
    this.modelStore = modelStore
    this.setToBottom = setToBottom

    this._activeMode = FACE_SELECTION_MODES.NONE
    this._hoveredFace = null
    this._highlightMesh = null
    this._normalIndicator = null
    this._modeChangeHandlers = new Set()
    this._hullMap = new Map() // Store convex hulls by model

    this.selectionManager.onHover = intersections => this._handleHover(intersections)
    this.selectionManager.onPointerDownIntersections = intersections => this._handlePointerDown(intersections)
  }

  registerModel(model) {
    const hull = this._createHull(model)
    if (hull)
      this._hullMap.set(model, hull)
  }

  unregisterModel(model) {
    if (this._hoveredFace?.mesh === model || this._hoveredFace?.mesh?.parent === model)
      this._hideHighlight(false)

    // Remove and clean up the hull
    const hull = this._hullMap.get(model)
    if (hull) {
      if (hull.parent === model)
        model.remove(hull)
      this._hullMap.delete(model)
    }
  }

  setFaceSelectionMode(isEnabled) {
    this.setLayOnFaceMode(isEnabled)
  }

  setLayOnFaceMode(isEnabled) {
    if (isEnabled)
      this._setMode(FACE_SELECTION_MODES.LAY_ON_FACE)
    else if (this._activeMode === FACE_SELECTION_MODES.LAY_ON_FACE)
      this._setMode(FACE_SELECTION_MODES.NONE)
  }

  setFaceOnTopMode(isEnabled) {
    if (isEnabled)
      this._setMode(FACE_SELECTION_MODES.FACE_ON_TOP)
    else if (this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP)
      this._setMode(FACE_SELECTION_MODES.NONE)
  }

  onModeChange(handler) {
    if (typeof handler !== 'function')
      return () => {}

    this._modeChangeHandlers.add(handler)
    return () => {
      this._modeChangeHandlers.delete(handler)
    }
  }

  toggleFaceSelectionMode() {
    this.toggleLayOnFaceMode()
  }

  toggleLayOnFaceMode() {
    this.setLayOnFaceMode(this._activeMode !== FACE_SELECTION_MODES.LAY_ON_FACE)
  }

  toggleFaceOnTopMode() {
    this.setFaceOnTopMode(this._activeMode !== FACE_SELECTION_MODES.FACE_ON_TOP)
  }

  isFaceSelectionModeActive() {
    return this.isLayOnFaceModeActive()
  }

  isLayOnFaceModeActive() {
    return this._activeMode === FACE_SELECTION_MODES.LAY_ON_FACE
  }

  isFaceOnTopModeActive() {
    return this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP
  }

  _setMode(mode = FACE_SELECTION_MODES.NONE) {
    const nextMode = mode || FACE_SELECTION_MODES.NONE
    if (this._activeMode === nextMode)
      return

    const previousMode = this._activeMode
    const shouldRender = this._highlightMesh?.visible || this._hoveredFace
    this._activeMode = nextMode
    this._hideHighlight(false)

    // Handle convex hull visibility for selected mesh
    const selectedModel = this.selectionManager.selectedObject
    if (selectedModel) {
      const hull = this._hullMap.get(selectedModel)
      if (hull) {
        // Entering lay on face mode - add hull to selected mesh
        if (nextMode === FACE_SELECTION_MODES.LAY_ON_FACE && previousMode !== FACE_SELECTION_MODES.LAY_ON_FACE) {
          if (hull.parent !== selectedModel)
            selectedModel.add(hull)
        }
        // Exiting lay on face mode - remove hull from selected mesh (keep the data)
        else if (previousMode === FACE_SELECTION_MODES.LAY_ON_FACE && nextMode !== FACE_SELECTION_MODES.LAY_ON_FACE) {
          if (hull.parent === selectedModel)
            selectedModel.remove(hull)
        }
      }
    }

    this._notifyModeChange()
    if (nextMode === FACE_SELECTION_MODES.NONE || shouldRender)
      this.render()
  }

  _notifyModeChange() {
    this._modeChangeHandlers.forEach((handler) => {
      try {
        handler(this._activeMode)
      }
      catch {
        // Ignore subscriber errors to avoid breaking mode updates
      }
    })
  }

  _handleHover(intersections) {
    if (this._activeMode === FACE_SELECTION_MODES.NONE) {
      this._hideHighlight()
      return
    }

    const intersection = this._resolveHoverIntersection(intersections)
    if (!intersection) {
      this._hideHighlight()
      return
    }

    const mesh = intersection.object
    const faceIndex = intersection.faceIndex
    if (faceIndex === undefined || faceIndex === null) {
      this._hideHighlight()
      return
    }

    if (this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP)
      this._updateFaceNormalIndicator(intersection, false)
    else
      this._hideNormalIndicator(false)

    if (this._hoveredFace
      && this._hoveredFace.mesh === mesh
      && this._hoveredFace.faceIndex === faceIndex) {
      if (this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP)
        this.render()
      return
    }

    this._showHighlight(mesh, faceIndex)
  }

  _resolveHoverIntersection(intersections) {
    if (!Array.isArray(intersections) || intersections.length === 0)
      return null

    if (this._activeMode === FACE_SELECTION_MODES.LAY_ON_FACE)
      return intersections.find(item => item.object?.userData?.isConvexHull && item.object !== this._highlightMesh) || null

    if (this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP)
      return intersections.find(item => item.object !== this._highlightMesh && !item.object?.userData?.isConvexHull && item.faceIndex !== undefined && item.faceIndex !== null) || null

    return null
  }

  _handlePointerDown(intersections) {
    if (this._activeMode === FACE_SELECTION_MODES.NONE)
      return false

    if (this._activeMode === FACE_SELECTION_MODES.LAY_ON_FACE)
      return this._handleLayOnFaceSelection(intersections)

    if (this._activeMode === FACE_SELECTION_MODES.FACE_ON_TOP)
      return this._handleFaceOnTopSelection(intersections)

    return false
  }

  _handleLayOnFaceSelection(intersections) {
    const hullIntersection = intersections.find(item => item.object?.userData?.isConvexHull)
    if (!hullIntersection)
      return false

    const model = this._findInteractiveAncestor(hullIntersection.object)
    if (!model)
      return false

    const aligned = this._alignModelFaceToNormal(hullIntersection, model, TARGET_NORMAL_LAY_ON_FACE, true)
    if (aligned) {
      this._setMode(FACE_SELECTION_MODES.NONE)
      this.selectionManager.selectObject(model)
    }
    return aligned
  }

  _handleFaceOnTopSelection(intersections) {
    const meshIntersection = intersections.find(item =>
      item.object !== this._highlightMesh
      && !item.object?.userData?.isConvexHull
      && item.faceIndex !== undefined
      && item.faceIndex !== null,
    )
    if (!meshIntersection)
      return false

    const model = this._findInteractiveAncestor(meshIntersection.object)
    if (!model)
      return false

    const aligned = this._alignModelFaceToNormal(meshIntersection, model, TARGET_NORMAL_FACE_ON_TOP, false)
    if (!aligned)
      return false

    this._setMode(FACE_SELECTION_MODES.NONE)
    this.selectionManager.selectObject(model)
    this.setToBottom(model)
    return true
  }

  _showHighlight(targetMesh, faceIndex) {
    // get the highlight mesh
    const highlight = this._getHighlightMesh()
    const parent = highlight.parent
    // remove the highlight from the parent if it is not the hull
    if (parent && parent !== targetMesh) {
      parent.remove(highlight)
    }
    // add the highlight to the hull if it is not already added
    if (!highlight.parent) {
      targetMesh.add(highlight)
    }

    // update the highlight geometry
    const updated = this._updateHighlightGeometry(highlight, targetMesh, faceIndex, this._activeMode)
    if (!updated) {
      this._hideHighlight()
      return
    }

    highlight.visible = true
    this._hoveredFace = { mesh: targetMesh, faceIndex }
    this.render()
  }

  _hideHighlight(shouldRender = true) {
    const highlightWasVisible = Boolean(this._highlightMesh?.visible)
    const hadHoveredFace = Boolean(this._hoveredFace)
    const indicatorHidden = this._hideNormalIndicator(false)

    if (this._highlightMesh)
      this._highlightMesh.visible = false

    if (hadHoveredFace)
      this._hoveredFace = null

    if (shouldRender && (indicatorHidden || hadHoveredFace || highlightWasVisible))
      this.render()
  }

  _getHighlightMesh() {
    if (this._highlightMesh)
      return this._highlightMesh

    const highlightMaterial = new MeshBasicMaterial({
      color: PRIMARY_HEX.HIGHLIGHT,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      depthTest: false,
      side: DoubleSide,
    })

    this._highlightMesh = new Mesh(new BufferGeometry(), highlightMaterial)
    this._highlightMesh.renderOrder = 9999
    this._highlightMesh.visible = false
    this._highlightMesh.name = 'face-selection-highlight'
    this._highlightMesh.raycast = () => {}
    return this._highlightMesh
  }

  _getNormalIndicator() {
    if (this._normalIndicator)
      return this._normalIndicator

    const color = PRIMARY_HEX.ARROW
    const emissive = PRIMARY_HEX.EMISSIVE
    this._normalIndicator = new ArrowHelper(new Vector3(0, 0, 1), new Vector3(), 1, color, 0.35, 0.2)
    this._normalIndicator.renderOrder = 10000

    const arrowMaterial = new MeshLambertMaterial({
      color,
      emissive,
      emissiveIntensity: 0.5,
    })
    this._normalIndicator.cone.material = arrowMaterial
    this._normalIndicator.line.material = arrowMaterial

    // this._normalIndicator.castShadow = true
    this._normalIndicator.receiveShadow = true
    this._normalIndicator.visible = false
    this._normalIndicator.name = 'face-normal-indicator'
    return this._normalIndicator
  }

  _updateHighlightGeometry(highlightMesh, targetMesh, faceIndex, mode) {
    const positionAttr = targetMesh.geometry?.getAttribute('position')
    const vertexIndices = mode === FACE_SELECTION_MODES.LAY_ON_FACE
      ? this._getCoplanarFaceVertexIndices(targetMesh, faceIndex)
      : this._getFaceVertexIndices(targetMesh.geometry, faceIndex)
    if (!positionAttr || !vertexIndices?.length)
      return false

    const positionArray = new Float32Array(vertexIndices.length * 3)
    vertexIndices.forEach((vertexIdx, idx) => {
      positionArray[idx * 3] = positionAttr.getX(vertexIdx)
      positionArray[idx * 3 + 1] = positionAttr.getY(vertexIdx)
      positionArray[idx * 3 + 2] = positionAttr.getZ(vertexIdx)
    })

    const geometry = highlightMesh.geometry
    geometry.setAttribute('position', new Float32BufferAttribute(positionArray, 3))
    geometry.computeVertexNormals()
    geometry.attributes.position.needsUpdate = true
    return true
  }

  _updateFaceNormalIndicator(intersection, shouldRender = true) {
    const targetMesh = intersection?.object
    const faceIndex = intersection?.faceIndex
    if (!targetMesh || faceIndex === undefined || faceIndex === null)
      return this._hideNormalIndicator(shouldRender)

    const direction = this._getFaceNormal(targetMesh, faceIndex, intersection.face?.normal)
    if (!direction)
      return this._hideNormalIndicator(shouldRender)

    const indicator = this._getNormalIndicator()
    const parent = indicator.parent
    if (parent && parent !== targetMesh)
      parent.remove(indicator)
    if (!indicator.parent)
      targetMesh.add(indicator)

    const localPoint = targetMesh.worldToLocal(intersection.point.clone())
    indicator.position.copy(localPoint)
    indicator.setDirection(direction)

    const length = this._getNormalIndicatorLength(targetMesh)
    const headLength = Math.min(length * 0.4, length)
    const headWidth = Math.min(length * 0.2, length)
    indicator.setLength(length, headLength, headWidth)
    indicator.visible = true

    if (shouldRender)
      this.render()

    return true
  }

  _hideNormalIndicator(shouldRender = true) {
    if (this._normalIndicator && this._normalIndicator.visible) {
      this._normalIndicator.visible = false
      if (shouldRender)
        this.render()
      return true
    }
    return false
  }

  _alignModelFaceToNormal(intersection, model, targetNormal, alignFaceToGround) {
    const targetMesh = intersection.object
    const faceIndex = intersection.faceIndex
    if (faceIndex === undefined || faceIndex === null)
      return false

    const faceVertices = this._getFaceVertices(targetMesh, faceIndex)
    if (faceVertices.length < 3)
      return false

    targetMesh.updateWorldMatrix(true, false)
    model.updateWorldMatrix(true, false)

    const worldVertices = faceVertices.map(vertex => vertex.clone().applyMatrix4(targetMesh.matrixWorld))
    const edgeA = new Vector3().subVectors(worldVertices[1], worldVertices[0])
    const edgeB = new Vector3().subVectors(worldVertices[2], worldVertices[0])
    const normal = new Vector3().crossVectors(edgeA, edgeB).normalize()
    if (!normal.lengthSq())
      return false

    const rotationQuat = new Quaternion().setFromUnitVectors(normal, targetNormal)
    if (Number.isNaN(rotationQuat.x) || Number.isNaN(rotationQuat.y) || Number.isNaN(rotationQuat.z))
      return false

    model.applyQuaternion(rotationQuat)

    model.updateWorldMatrix(true, false)
    targetMesh.updateWorldMatrix(true, false)

    if (alignFaceToGround) {
      const rotatedVertices = faceVertices.map(vertex => vertex.clone().applyMatrix4(targetMesh.matrixWorld))
      const averageZ = rotatedVertices.reduce((sum, vertex) => sum + vertex.z, 0) / rotatedVertices.length
      model.position.z -= averageZ
    }

    if (this.selectionManager.selectedObject === model)
      this.modelStore.syncSelectedModel()

    this.render()
    return true
  }

  _createHull(mesh) {
    const points = []
    const positionAttr = mesh.geometry?.attributes?.position
    if (!positionAttr)
      return null

    for (let i = 0; i < positionAttr.count; i++) {
      points.push(new Vector3(positionAttr.getX(i), positionAttr.getY(i), positionAttr.getZ(i)))
    }

    if (points.length < 4)
      return null

    const hullGeometry = new ConvexGeometry(points)
    this._inflateHullGeometry(hullGeometry)

    const baseColor = new Color(PRIMARY_HEX.HIGHLIGHT)
    const positionCount = hullGeometry.attributes.position.count
    const colorArray = new Float32Array(positionCount * 3)
    for (let i = 0; i < positionCount; i++) {
      colorArray[i * 3] = baseColor.r
      colorArray[i * 3 + 1] = baseColor.g
      colorArray[i * 3 + 2] = baseColor.b
    }
    hullGeometry.setAttribute('color', new Float32BufferAttribute(colorArray, 3))

    const hullMaterial = new MeshBasicMaterial({
      vertexColors: true,
      opacity: 0,
      transparent: true,
      depthWrite: false,
    })

    const hullMesh = new Mesh(hullGeometry, hullMaterial)
    hullMesh.name = `${mesh.name || 'model'}-convex-hull`
    hullMesh.renderOrder = (mesh.renderOrder || 0) + 1
    hullMesh.userData.isConvexHull = true
    return hullMesh
  }

  _inflateHullGeometry(geometry) {
    const positionAttr = geometry.getAttribute('position')
    const vertex = new Vector3()
    const normal = new Vector3()

    const offsetDistance = Math.max(
      CONVEX_HULL_OFFSET_MIN,
      this._computeBoundingSphereRadius(geometry) * CONVEX_HULL_OFFSET_RATIO,
    )

    for (let i = 0; i < positionAttr.count; i++) {
      vertex.fromBufferAttribute(positionAttr, i)
      normal.copy(vertex).normalize()
      vertex.addScaledVector(normal, offsetDistance)
      positionAttr.setXYZ(i, vertex.x, vertex.y, vertex.z)
    }
    positionAttr.needsUpdate = true
    geometry.computeVertexNormals()
  }

  _computeBoundingSphereRadius(geometry) {
    geometry.computeBoundingSphere()
    return geometry.boundingSphere?.radius || 1
  }

  _getNormalIndicatorLength(targetMesh) {
    const geometry = targetMesh?.geometry
    if (!geometry)
      return 1

    if (!geometry.boundingSphere)
      geometry.computeBoundingSphere()

    const radius = geometry.boundingSphere?.radius || 1
    return Math.max(radius * 0.15, 1)
  }

  _getFaceVertices(mesh, faceIndex) {
    const positionAttr = mesh.geometry?.getAttribute('position')
    const vertexIndices = this._getFaceVertexIndices(mesh.geometry, faceIndex)
    if (!positionAttr || !vertexIndices.length)
      return []

    return vertexIndices.map(idx => new Vector3(
      positionAttr.getX(idx),
      positionAttr.getY(idx),
      positionAttr.getZ(idx),
    ))
  }

  _getFaceNormal(mesh, faceIndex, fallbackNormal = null) {
    if (fallbackNormal?.lengthSq())
      return fallbackNormal.clone().normalize()

    const faceVertices = this._getFaceVertices(mesh, faceIndex)
    if (faceVertices.length < 3)
      return null

    const edgeA = new Vector3().subVectors(faceVertices[1], faceVertices[0])
    const edgeB = new Vector3().subVectors(faceVertices[2], faceVertices[0])
    const normal = new Vector3().crossVectors(edgeA, edgeB)
    if (!normal.lengthSq())
      return null

    return normal.normalize()
  }

  _getFaceVertexIndices(geometry, faceIndex) {
    if (faceIndex === undefined || faceIndex === null)
      return []

    if (geometry.index) {
      const base = faceIndex * 3
      return [
        geometry.index.getX(base),
        geometry.index.getX(base + 1),
        geometry.index.getX(base + 2),
      ]
    }

    const start = faceIndex * 3
    return [start, start + 1, start + 2]
  }

  _getCoplanarFaceVertexIndices(hullMesh, faceIndex) {
    if (!hullMesh)
      return null

    if (!Object.prototype.hasOwnProperty.call(hullMesh.userData, 'coplanarFaceGroups')) {
      hullMesh.userData.coplanarFaceGroups = this._buildHullFaceGroups(hullMesh.geometry) || null
    }

    return hullMesh.userData.coplanarFaceGroups?.[faceIndex] || null
  }

  _buildHullFaceGroups(geometry) {
    const positionAttr = geometry?.getAttribute('position')
    if (!positionAttr)
      return null

    const faceCount = geometry.index
      ? Math.floor(geometry.index.count / 3)
      : Math.floor(positionAttr.count / 3)
    if (!faceCount)
      return null

    const groupsByKey = new Map()
    const faceToGroup = Array.from({ length: faceCount }, () => [])
    const vertexA = new Vector3()
    const vertexB = new Vector3()
    const vertexC = new Vector3()
    const edge1 = new Vector3()
    const edge2 = new Vector3()
    const normal = new Vector3()

    for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
      const vertexIndices = this._getFaceVertexIndices(geometry, faceIndex)
      if (vertexIndices.length < 3)
        continue

      vertexA.set(
        positionAttr.getX(vertexIndices[0]),
        positionAttr.getY(vertexIndices[0]),
        positionAttr.getZ(vertexIndices[0]),
      )
      vertexB.set(
        positionAttr.getX(vertexIndices[1]),
        positionAttr.getY(vertexIndices[1]),
        positionAttr.getZ(vertexIndices[1]),
      )
      vertexC.set(
        positionAttr.getX(vertexIndices[2]),
        positionAttr.getY(vertexIndices[2]),
        positionAttr.getZ(vertexIndices[2]),
      )

      edge1.subVectors(vertexB, vertexA)
      edge2.subVectors(vertexC, vertexA)
      normal.crossVectors(edge1, edge2)
      if (!normal.lengthSq())
        continue

      normal.normalize()
      const key = this._getNormalKey(normal)
      if (!groupsByKey.has(key))
        groupsByKey.set(key, [])

      const group = groupsByKey.get(key)
      group.push(...vertexIndices)
      faceToGroup[faceIndex] = group
    }

    return faceToGroup
  }

  _getNormalKey(normal) {
    const formatComponent = (value) => {
      const clamped = Math.abs(value) < NORMAL_KEY_EPSILON ? 0 : value
      return clamped.toFixed(NORMAL_KEY_PRECISION)
    }

    return [formatComponent(normal.x), formatComponent(normal.y), formatComponent(normal.z)].join('|')
  }

  _findInteractiveAncestor(object) {
    let current = object
    const interactiveObjects = this.selectionManager.interactiveObjects

    while (current && !interactiveObjects.includes(current))
      current = current.parent

    return current || null
  }
}
