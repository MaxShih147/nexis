import { SCENE_COLORS } from '@/constants/theme.js'
import { useParamsStore } from '@/stores/useParamsStore'
import { storeToRefs } from 'pinia'
import * as THREE from 'three'
import { watch } from 'vue'
import { AxisHelper } from './managers/AxisHelper.js'

// nexis: default factory floor — a large square platform drawn as a 10×10 grid.
const GRID_DIVISIONS = 10
const FALLBACK_BED_SIZE = {
  width: 300,
  height: 300,
}

/**
 * Creates the base scene with all required components
 * @param {HTMLElement} container - The DOM element hosting the renderer
 * @returns {object} Scene components and helpers
 */
export function createBaseScene(container) {
  // Create core components
  const scene = createScene()
  const camera = createCamera()
  const renderer = createRenderer(container)
  const paramsStore = useParamsStore()
  const { bedSize } = storeToRefs(paramsStore)

  const clippingPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0)
  renderer.clippingPlanes = [clippingPlane]
  clippingPlane.constant = 999

  // Create scene elements
  const initialBedSize = resolveBedSize(bedSize.value)
  const lights = createLights()
  const plane = createPlane(initialBedSize.width, initialBedSize.height)
  const axisHelper = new AxisHelper(camera, renderer, scene)

  // Add elements to scene
  lights.forEach(light => scene.add(light))
  scene.add(plane)

  watch(bedSize, ([width, height]) => {
    if (!width || !height)
      return
    if (!resizePlane(plane, width, height))
      return
    renderer.render(scene, camera)
    axisHelper.render()
  }, { flush: 'post' })

  // Setup resize handler
  setupResizeHandler(container, renderer, camera, axisHelper, scene)

  return { scene, camera, renderer, plane, axisHelper, clippingPlane }
}

/**
 * Creates a basic Three.js scene
 * @returns {THREE.Scene} The created scene
 */
function createScene() {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(SCENE_COLORS.DARK)
  return scene
}

/**
 * Sets up the window resize handler
 * @param {HTMLElement} container - The container element
 * @param {THREE.WebGLRenderer} renderer - The renderer
 * @param {THREE.Camera} camera - The camera
 * @param {AxisHelper} axisHelper - The axis helper
 * @param {THREE.Scene} scene - The scene
 */
function setupResizeHandler(container, renderer, camera, axisHelper, scene) {
  const handleResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight)
    camera.aspect = container.clientWidth / container.clientHeight
    camera.updateProjectionMatrix()
    axisHelper.update()
    renderer.render(scene, camera)
    axisHelper.render()
  }

  window.addEventListener('resize', handleResize)
}

/**
 * Creates an array of lights for the scene
 * @returns {Array<THREE.Light>} Array of lights
 */
function createLights() {
  // Create ambient light
  const ambientLight = new THREE.AmbientLight(SCENE_COLORS.LIGHT, 0.1)

  // Create directional lights
  const createDirectionalLight = (x, y, z) => {
    const light = new THREE.DirectionalLight(SCENE_COLORS.LIGHT, 0.5)
    light.position.set(x, y, z)
    light.castShadow = true
    return light
  }

  const directionalLight1 = createDirectionalLight(50, 350, 50)
  const directionalLight2 = createDirectionalLight(-350, 50, 50)

  // Create spot light
  const spotLight = new THREE.SpotLight(SCENE_COLORS.LIGHT)
  spotLight.position.set(50, -350, 600)
  spotLight.angle = Math.PI * 0.2
  spotLight.decay = 0
  spotLight.castShadow = true

  // Configure spot light shadow
  Object.assign(spotLight.shadow, {
    camera: {
      near: 200,
      far: 400,
    },
    bias: -0.000222,
    mapSize: {
      width: 512,
      height: 512,
    },
  })

  return [ambientLight, directionalLight1, directionalLight2, spotLight]
}

/**
 * Creates a camera for the scene
 * @returns {THREE.PerspectiveCamera} The created camera
 */
function createCamera() {
  const camera = new THREE.PerspectiveCamera(
    35, // Field of view
    window.innerWidth / window.innerHeight, // Aspect ratio
    1, // Near clipping plane
    4000, // Far clipping plane
  )
  camera.position.set(-300, -300, 200)
  return camera
}

/**
 * Creates a renderer for the scene
 * @param {HTMLElement} container - The container element
 * @returns {THREE.WebGLRenderer} The created renderer
 */
function createRenderer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(container.clientWidth, container.clientHeight)
  renderer.autoClear = false
  container.appendChild(renderer.domElement)
  return renderer
}

/**
 * Creates a plane with grid
 * @param {number} width - The width of the plane
 * @param {number} height - The height of the plane
 * @returns {THREE.Mesh} The created plane
 */
export function createPlane(width, height) {
  // Create plane geometry and material
  const planeGeometry = new THREE.PlaneGeometry(width, height)
  const planeMaterial = new THREE.ShadowMaterial({
    color: 0x000000,
    opacity: 1,
  })

  // Create plane mesh
  const plane = new THREE.Mesh(planeGeometry, planeMaterial)
  plane.name = 'plane'
  plane.receiveShadow = true
  plane.size = new THREE.Vector3(width, height, 0)

  addPlaneDecorations(plane, width, height)

  return plane
}

export function resizePlane(plane, width, height) {
  if (!plane || !width || !height)
    return false

  if (plane.size?.x === width && plane.size?.y === height)
    return false

  if (plane.geometry)
    plane.geometry.dispose()

  plane.geometry = new THREE.PlaneGeometry(width, height)
  if (plane.size instanceof THREE.Vector3)
    plane.size.set(width, height, 0)
  else
    plane.size = new THREE.Vector3(width, height, 0)

  clearPlaneDecorations(plane)
  addPlaneDecorations(plane, width, height)
  return true
}

function addPlaneDecorations(plane, width, height) {
  plane.add(createGrid(width, height, GRID_DIVISIONS))
}

function clearPlaneDecorations(plane) {
  for (const child of [...plane.children]) {
    plane.remove(child)
    disposeResources(child)
  }
}

function disposeResources(object) {
  if (!object || typeof object.traverse !== 'function')
    return

  object.traverse((child) => {
    if (child.geometry && typeof child.geometry.dispose === 'function')
      child.geometry.dispose()

    const { material } = child
    if (Array.isArray(material))
      material.forEach(mat => mat?.dispose?.())
    else
      material?.dispose?.()
  })
}

function resolveBedSize(sizeArray) {
  if (Array.isArray(sizeArray) && sizeArray.length >= 2) {
    const [width, height] = sizeArray
    if (width && height)
      return { width, height }
  }

  return { ...FALLBACK_BED_SIZE }
}

/**
 * Creates the floor grid: an accent border rectangle plus full grid lines that
 * divide the platform into `divisions × divisions` cells (graph-paper style).
 * @param {number} width - The width of the grid
 * @param {number} length - The length of the grid
 * @param {number} divisions - Number of cells along each axis
 * @returns {THREE.Group} The created grid
 */
function createGrid(width, length, divisions) {
  const group = new THREE.Group()

  const halfWidth = width / 2
  const halfLength = length / 2

  const { borderVertices, lineVertices } = createGridVertices(halfWidth, halfLength, divisions)

  const borderGeometry = new THREE.BufferGeometry()
  borderGeometry.setAttribute('position', new THREE.Float32BufferAttribute(borderVertices, 3))
  const borderMaterial = new THREE.LineBasicMaterial({ color: SCENE_COLORS.ACCENT })
  const border = new THREE.LineSegments(borderGeometry, borderMaterial)
  border.name = 'grid-border'

  const lineGeometry = new THREE.BufferGeometry()
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lineVertices, 3))
  const lineMaterial = new THREE.LineBasicMaterial({ color: SCENE_COLORS.GRID, transparent: true, opacity: 0.5 })
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial)
  lines.name = 'grid-lines'

  group.add(border, lines)
  return group
}

function createGridVertices(halfWidth, halfLength, divisions) {
  const borderVertices = []
  const lineVertices = []

  // Border rectangle
  borderVertices.push(
    -halfWidth, -halfLength, 0, halfWidth, -halfLength, 0,
    -halfWidth, halfLength, 0, halfWidth, halfLength, 0,
    -halfWidth, -halfLength, 0, -halfWidth, halfLength, 0,
    halfWidth, -halfLength, 0, halfWidth, halfLength, 0,
  )

  // Interior grid lines splitting the platform into divisions × divisions cells.
  // (Outer edges are drawn by the accent border, so only i = 1..divisions-1.)
  const cellX = (halfWidth * 2) / divisions
  const cellY = (halfLength * 2) / divisions

  for (let i = 1; i < divisions; i++) {
    const x = -halfWidth + i * cellX
    lineVertices.push(x, -halfLength, 0, x, halfLength, 0) // vertical line
  }
  for (let j = 1; j < divisions; j++) {
    const y = -halfLength + j * cellY
    lineVertices.push(-halfWidth, y, 0, halfWidth, y, 0) // horizontal line
  }

  return { borderVertices, lineVertices }
}
