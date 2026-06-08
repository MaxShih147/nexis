// /3d/managers/SelectionManager.js
import { BufferGeometry, Mesh, Raycaster, Vector2 } from 'three'
import { acceleratedRaycast, computeBoundsTree, disposeBoundsTree } from 'three-mesh-bvh'

/**
 * Manages object selection in the scene using raycasting.
 */
export class SelectionManager {
  /**
   * Constructor for the SelectionManager.
   * @param {THREE.Scene} scene - The Three.js scene.
   * @param {THREE.Camera} camera - The active Three.js camera.
   * @param {HTMLElement} domElement - The renderer's DOM element for capturing input.
   */
  constructor(scene, camera, domElement) {
    BufferGeometry.prototype.computeBoundsTree = computeBoundsTree
    BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree
    Mesh.prototype.raycast = acceleratedRaycast
    this.scene = scene
    this.camera = camera
    this.domElement = domElement
    this.interactiveObjects = []
    this.raycaster = new Raycaster()
    this.pointer = new Vector2()
    this.selectedObject = null
    // this.highlightMaterial = new MeshStandardMaterial({ color: 0xFFFFFF }) // Highlight color
    this.originalMaterial = null // Store original materials

    // Callbacks
    this.onSelect = null // Triggered when an object is selected
    this.onDoubleClickObject = null
    this.onHover = null
    this.onDeselect = null
    this.onPointerDownIntersections = null
    this.shouldDeselect = null // optional guard: return false to cancel deselection
    this.enabled = true // set to false to suppress all selection events

    // Event listeners
    this._pointerDownHandler = event => this.onPointerDown(event)
    this._pointerMoveHandler = event => this.onPointerMove(event)
    this._doubleClickHandler = event => this.onDoubleClick(event)
    this.domElement.addEventListener('pointerdown', this._pointerDownHandler)
    this.domElement.addEventListener('pointermove', this._pointerMoveHandler)
    this.domElement.addEventListener('dblclick', this._doubleClickHandler)
  }

  /**
   * Handle pointer down events (e.g., mouse clicks).
   * @param {MouseEvent} event - The mouse event.
   */
  onPointerDown(event) {
    if (!this.enabled)
      return
    // Convert screen space coordinates to normalized device coordinates
    const rect = this.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update raycaster from the pointer's screen position
    this.raycaster.setFromCamera(this.pointer, this.camera)

    // Modifier keys for multi-selection (Cmd/Ctrl = toggle, Shift = additive)
    const modifiers = { additive: !!(event.metaKey || event.ctrlKey || event.shiftKey) }

    if (this.interactiveObjects.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true)
      if (intersects.length > 0) {
        if (typeof this.onPointerDownIntersections === 'function') {
          const handled = this.onPointerDownIntersections(intersects)
          if (handled)
            return
        }
        const interactiveHit = this._findInteractiveAncestor(intersects[0].object)
        if (interactiveHit) {
          this.selectObject(interactiveHit, modifiers)
        }
      }
    }
  }

  _findInteractiveAncestor(object) {
    let current = object
    while (current && !this.interactiveObjects.includes(current)) {
      current = current.parent
    }
    return current
  }

  /**
   * Handle pointer move events for hover interactions.
   * @param {MouseEvent} event - The mouse event.
   */
  onPointerMove(event) {
    if (!this.enabled)
      return
    if (typeof this.onHover !== 'function')
      return

    const rect = this.domElement.getBoundingClientRect()
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)

    if (this.interactiveObjects.length === 0) {
      this.onHover([])
      return
    }

    const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true)
    this.onHover(intersects)
  }

  // onPointerUp(_event) {
  //   this.deselectObject()
  // }

  /**
   * if double click on the model, call onDoubleClickObject, otherwise deselect
   * @param {MouseEvent} event - The mouse event.
   */
  onDoubleClick(event) {
    if (!this.enabled)
      return
    const rect = this.domElement.getBoundingClientRect()

    // Convert screen space coordinates to normalized device coordinates
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    // Update raycaster from the pointer's screen position
    this.raycaster.setFromCamera(this.pointer, this.camera)

    if (this.interactiveObjects.length > 0) {
      const intersects = this.raycaster.intersectObjects(this.interactiveObjects, true)
      if (intersects.length > 0) {
        const hitObject = this._findInteractiveAncestor(intersects[0].object) || intersects[0].object
        if (typeof this.onDoubleClickObject === 'function' && hitObject) {
          this.onDoubleClickObject(hitObject)
        }
      }
      else {
        const guard = typeof this.shouldDeselect !== 'function' || this.shouldDeselect()
        if (guard)
          this.deselectObject()
      }
    }
  }

  /**
   * Add an object to the list of interactive objects.
   * @param {THREE.Object3D} object - The object to add.
   */
  addInteractiveObject(object) {
    this.interactiveObjects.push(object)
  }

  /**
   * Select an object and trigger the onSelect callback.
   * @param {THREE.Object3D} object - The object to select.
   * @param {{ additive?: boolean }} [modifiers] - modifier-key state for multi-select.
   */
  selectObject(object, modifiers = {}) {
    // For plain (non-additive) clicks, avoid re-selecting the same object.
    // Additive clicks must always fire so the set can toggle the object off.
    if (!modifiers.additive && this.selectedObject === object)
      return

    this.selectedObject = object

    // Trigger callback if set
    if (typeof this.onSelect === 'function') {
      this.onSelect(object, modifiers)
    }
  }

  /**
   * Deselect the currently selected object and trigger the onDeselect callback.
   */
  deselectObject() {
    if (!this.selectedObject)
      return

    const deselected = this.selectedObject
    // deselected.material = this.originalMaterial
    this.selectedObject = null
    // Trigger callback if set
    if (typeof this.onDeselect === 'function') {
      this.onDeselect(deselected)
    }
  }

  /**
   * Clean up event listeners and references.
   */
  dispose() {
    if (this.domElement) {
      this.domElement.removeEventListener('pointerdown', this._pointerDownHandler)
      this.domElement.removeEventListener('pointermove', this._pointerMoveHandler)
      this.domElement.removeEventListener('dblclick', this._doubleClickHandler)
    }
    this.deselectObject() // Ensure any selected object is properly cleaned up
    this.scene = null
    this.camera = null
    this.domElement = null
    this.raycaster = null
    this.pointer = null
    this.originalMaterial = null
  }
}
