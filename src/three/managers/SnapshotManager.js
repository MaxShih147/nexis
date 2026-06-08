import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader'
import { getRGB } from '../../utils/imageUtils'

export class SnapshotManager {
  constructor() {
    // Create basic scene
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x2D2E32)

    // Match the main scene's camera (createBaseScene): Z-up world,
    // FOV 35°, default look-from direction = (-300, -300, 200).
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 4000)
    this.camera.up.set(0, 0, 1)

    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setPixelRatio(1)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.0
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    // Load HDRI environment map
    const rgbeLoader = new RGBELoader()
    rgbeLoader.load('/environment.hdr', (texture) => {
      texture.mapping = THREE.EquirectangularReflectionMapping
      this.scene.environment = texture
      // this.scene.background = texture
    })
  }

  /**
   * Takes snapshots of a mesh at specified resolutions
   * @param {THREE.Mesh} mesh - The mesh to capture
   * @param {Array<{width: number, height: number}>} resolutions - Array of resolution objects with width and height
   * @returns {Promise<Array<Blob>>} Array of PNG blobs for each resolution
   */
  async takeSnapshots(mesh, resolutions = [{ width: 400, height: 300 }], outputType = 'blob') {
    // Clear any existing lights from the scene
    this.scene.children.forEach((child) => {
      if (child instanceof THREE.Light) {
        this.scene.remove(child)
      }
    })
    // Clone mesh so the original stays in the main scene
    const clone = mesh.clone(true)
    clone.position.copy(mesh.position)
    clone.rotation.copy(mesh.rotation)
    clone.scale.copy(mesh.scale)
    this.scene.add(clone)

    // Calculate bounding box
    const box = new THREE.Box3().setFromObject(mesh)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())

    // Use the main scene's default look direction (-300, -300, 200) and
    // pick a distance that fits the largest bbox dimension in our FOV.
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = this.camera.fov * (Math.PI / 180)
    const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.57
    const direction = new THREE.Vector3(-300, -300, 200).normalize()

    this.camera.position.copy(center).addScaledVector(direction, distance)
    this.camera.lookAt(center)

    // Add lights relative to mesh position
    const ambientLight = new THREE.AmbientLight(0xFFFFFF, 0.5)
    this.scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xFFFFFF, 1)
    directionalLight.position.set(
      center.x + 5,
      center.y + 5,
      center.z + 5,
    )
    this.scene.add(directionalLight)

    // Take snapshots at each resolution
    const snapshots = []
    for (const resolution of resolutions) {
      // Set renderer size
      this.renderer.setSize(resolution.width, resolution.height)

      this.camera.aspect = resolution.width / resolution.height
      this.camera.updateProjectionMatrix()

      // Render scene
      this.renderer.render(this.scene, this.camera)

      // Convert to blob
      if (outputType === 'blob') {
        const blob = await new Promise((resolve) => {
          this.renderer.domElement.toBlob(resolve, 'image/png')
        })
        snapshots.push(blob)
      }
      else if (outputType === 'rawRGB') {
        const canvas = this.renderer.domElement
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = canvas.width
        tempCanvas.height = canvas.height
        const context = tempCanvas.getContext('2d')
        context.drawImage(canvas, 0, 0)
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
        const rawRGB = getRGB(imageData.data, 3)
        snapshots.push(rawRGB)
      }
    }

    return snapshots
  }

  /**
   * Disposes of the manager's resources
   */
  dispose() {
    this.renderer.dispose()
    this.scene.clear()
  }
}
