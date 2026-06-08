import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

/**
 * Custom drag controller that keeps models on a fixed-Z plane.
 *
 * On drag start the controller:
 *   1. Finds which draggable object was picked.
 *   2. Builds a horizontal plane (normal = +Z) at the object's current Z height.
 *   3. Records the grab offset (hit-point − object-origin) so the model
 *      never snaps to the cursor.
 *
 * Every subsequent pointer move projects the cursor onto that frozen plane and
 * applies the grab offset, updating only X and Y while leaving Z untouched.
 */
class PlanarDragControls extends THREE.EventDispatcher {
  /** @param {THREE.Object3D[]} objects  @param {THREE.Camera} camera  @param {HTMLElement} domElement */
  constructor(objects, camera, domElement) {
    super()
    this.objects = objects

    this._camera = camera
    this._domElement = domElement

    this._raycaster = new THREE.Raycaster()
    this._dragPlane = new THREE.Plane()
    this._grabOffset = new THREE.Vector3()
    this._mouseNDC = new THREE.Vector2()
    this._intersection = new THREE.Vector3()

    this._dragObject = null

    // Bind once so the same reference can be removed later
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)

    this.connect()
  }

  connect() {
    this._domElement.addEventListener('pointerdown', this._onPointerDown)
    this._domElement.addEventListener('pointermove', this._onPointerMove)
    this._domElement.addEventListener('pointerup', this._onPointerUp)
  }

  disconnect() {
    this._domElement.removeEventListener('pointerdown', this._onPointerDown)
    this._domElement.removeEventListener('pointermove', this._onPointerMove)
    this._domElement.removeEventListener('pointerup', this._onPointerUp)
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  _updateNDC(event) {
    const rect = this._domElement.getBoundingClientRect()
    this._mouseNDC.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )
  }

  /** Walk up the scene graph to find the top-level draggable ancestor. */
  _findDraggable(hitObject) {
    let node = hitObject
    while (node) {
      if (this.objects.includes(node))
        return node
      node = node.parent
    }
    return null
  }

  // ── Pointer event handlers ───────────────────────────────────────────────

  _onPointerDown(event) {
    if (event.button !== 0)
      return

    this._updateNDC(event)
    this._raycaster.setFromCamera(this._mouseNDC, this._camera)

    const hits = this._raycaster.intersectObjects(this.objects, true)
    if (hits.length === 0)
      return

    const draggable = this._findDraggable(hits[0].object)
    if (!draggable)
      return

    // Horizontal plane at the object's current Z height (scene uses Z-up).
    // Plane equation: dot((0,0,1), p) + constant = 0  →  constant = −z
    this._dragPlane.set(new THREE.Vector3(0, 0, 1), -draggable.position.z)

    // Grab offset: preserves the point where the user clicked on the model
    if (this._raycaster.ray.intersectPlane(this._dragPlane, this._intersection)) {
      this._grabOffset.copy(this._intersection).sub(draggable.position)
    }
    else {
      this._grabOffset.set(0, 0, 0)
    }

    this._dragObject = draggable
    this._domElement.setPointerCapture(event.pointerId)

    this.dispatchEvent({ type: 'dragstart', object: draggable })
  }

  _onPointerMove(event) {
    if (!this._dragObject)
      return

    this._updateNDC(event)
    this._raycaster.setFromCamera(this._mouseNDC, this._camera)

    if (!this._raycaster.ray.intersectPlane(this._dragPlane, this._intersection))
      return

    // Move model so that the originally grabbed point stays under the cursor
    this._dragObject.position.x = this._intersection.x - this._grabOffset.x
    this._dragObject.position.y = this._intersection.y - this._grabOffset.y
    // Z is intentionally left unchanged

    this.dispatchEvent({ type: 'drag', object: this._dragObject })
  }

  _onPointerUp(event) {
    if (!this._dragObject)
      return

    this._domElement.releasePointerCapture(event.pointerId)
    const object = this._dragObject
    this._dragObject = null

    this.dispatchEvent({ type: 'dragend', object })
  }
}

export class ControlsManager {
  constructor(camera, renderer) {
    this.cameraControl = new OrbitControls(camera, renderer.domElement)
    this.cameraControl.enableDamping = true
    this.cameraControl.dampingFactor = 0.7

    this.transformControl = new TransformControls(camera, renderer.domElement)
    this.transformControl.addEventListener('dragging-changed', (event) => {
      this.cameraControl.enabled = !event.value
      event.value ? this.dragControl.disconnect() : this.dragControl.connect()
    })

    this.dragControl = new PlanarDragControls([], camera, renderer.domElement)

    this.dragControl.addEventListener('dragstart', () => {
      this.cameraControl.enabled = false
      this.transformControl.enabled = false
    })
    this.dragControl.addEventListener('dragend', () => {
      this.cameraControl.enabled = true
      this.transformControl.enabled = true
    })
  }
}
