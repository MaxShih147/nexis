import { PRIMARY_HEX } from '@/constants/theme.js'
import { ViewportGizmo } from 'three-viewport-gizmo'

// Default color constants
const DEFAULT_COLORS = {
  FACE: 0x2D2E32,
  LABEL: 0xFFFFFF,
  BACKGROUND: 0x2D2E32,
  BORDER: PRIMARY_HEX.ACCENT,
  HOVER: 0x2D2E32,
  HOVER_LABEL: 0xFFFFFF,
  HOVER_BORDER: PRIMARY_HEX.ACCENT,
}

// Default configuration
const DEFAULT_CONFIG = {
  type: 'cube',
  placement: 'top-left',
  offset: { left: 270, top: 10 },
  resolution: 2048,
}

const AXIS_HELPER_Z_INDEX = '20'

/**
 * AxisHelper class that encapsulates all axis helper functionality
 * Follows OOP principles with proper encapsulation and single responsibility
 */
export class AxisHelper {
  /**
   * Creates an AxisHelper instance
   * @param {THREE.Camera} camera - The camera to attach to
   * @param {THREE.WebGLRenderer} renderer - The renderer instance
   * @param {THREE.Scene} scene - The scene for rendering
   * @param {object} options - Configuration options
   */
  constructor(camera, renderer, scene, options = {}) {
    this._camera = camera
    this._renderer = renderer
    this._scene = scene
    this._usesResponsiveOffset = options.offset == null
    const responsiveOffset = this._usesResponsiveOffset ? this._getResponsiveOffset() : options.offset
    this._options = { ...DEFAULT_CONFIG, ...options, offset: responsiveOffset }
    this._colors = { ...DEFAULT_COLORS }
    this._gizmo = null
    this._cameraControls = null
    this._renderCallback = null

    this._initialize()
  }

  /**
   * Initialize the axis helper
   * @private
   */
  _initialize() {
    this._createGizmo()
    this._setupEventListeners()
    this._setupAnisotropy()
  }

  /**
   * Create the ViewportGizmo with default configuration
   * @private
   */
  _createGizmo() {
    this._gizmo = new ViewportGizmo(this._camera, this._renderer, this._buildConfig())
    this._applyDomOverrides()
  }

  /**
   * Re-apply DOM style overrides after library lifecycle calls.
   * The third-party gizmo defaults to z-index 1000.
   * @private
   */
  _applyDomOverrides() {
    if (this._gizmo && this._gizmo._domElement) {
      this._gizmo._domElement.style.zIndex = AXIS_HELPER_Z_INDEX
    }
  }

  /**
   * Create face options for the gizmo
   * @private
   * @returns {object} Face options configuration
   */
  _createFaceOptions() {
    return {
      opacity: 1,
      scale: 0.8,
      line: false,
      color: this._colors.FACE,
      labelColor: this._colors.LABEL,
      hover: {
        color: this._colors.HOVER,
        labelColor: this._colors.HOVER_LABEL,
        opacity: 1,
        scale: 0.8,
        border: {
          size: 0.02,
          color: this._colors.HOVER_BORDER,
        },
      },
      border: {
        size: 0.02,
        color: this._colors.BORDER,
      },
    }
  }

  /**
   * Create background options for the gizmo
   * @private
   * @returns {object} Background options configuration
   */
  _createBackgroundOptions() {
    return {
      enabled: true,
      color: this._colors.BACKGROUND,
      opacity: 1,
      hover: {
        color: this._colors.BACKGROUND,
        opacity: 1,
      },
    }
  }

  /**
   * Create corner options for the gizmo
   * @private
   * @returns {object} Corner options configuration
   */
  _createCornerOptions() {
    return {
      enabled: true,
      color: this._colors.FACE,
      opacity: 0,
      scale: 0.1,
      hover: {
        color: this._colors.HOVER,
        opacity: 0,
        scale: 0.1,
      },
    }
  }

  /**
   * Create edge options for the gizmo
   * @private
   * @returns {object} Edge options configuration
   */
  _createEdgeOptions() {
    return {
      enabled: true,
      color: this._colors.FACE,
      opacity: 0,
      scale: 0.5,
      hover: {
        color: this._colors.HOVER,
        opacity: 0,
        scale: 0.5,
      },
    }
  }

  /**
   * Setup event listeners for the gizmo
   * @private
   */
  _setupEventListeners() {
    this._gizmo.addEventListener('change', () => {
      this._renderScene()
    })

    this._gizmo.addEventListener('end', () => {
      this._renderScene()
    })
  }

  /**
   * Setup anisotropy for better texture quality
   * @private
   */
  _setupAnisotropy() {
    const maxAniso = this._renderer.capabilities.getMaxAnisotropy()
    for (const child of this._gizmo.children) {
      const material = child.material
      if (material.map) {
        material.map.anisotropy = maxAniso
        material.map.needsUpdate = true
      }
    }
  }

  /**
   * Render the scene and axis helper
   * @private
   */
  _renderScene() {
    this._renderer.render(this._scene, this._camera)
    this._gizmo.render()
    this._applyDomOverrides()
    if (this._renderCallback) {
      this._renderCallback()
    }
  }

  /**
   * Build the gizmo configuration based on current options and colors
   * @private
   * @returns {object} Gizmo configuration
   */
  _buildConfig() {
    return {
      ...this._options,
      background: this._createBackgroundOptions(),
      corners: this._createCornerOptions(),
      edges: this._createEdgeOptions(),
      front: { ...this._createFaceOptions(), label: 'Back' },
      right: this._createFaceOptions(),
      top: this._createFaceOptions(),
      left: this._createFaceOptions(),
      bottom: this._createFaceOptions(),
      back: { ...this._createFaceOptions(), label: 'Front' },
    }
  }

  /**
   * Get the offset for the current viewport size
   * @private
   * @returns {{left: number, top: number}} Offset configuration
   */
  _getResponsiveOffset() {
    if (typeof window === 'undefined') {
      return { ...DEFAULT_CONFIG.offset }
    }

    const isMobile = window.matchMedia
      ? window.matchMedia('(max-width: 768px)').matches
      : window.innerWidth <= 768

    return isMobile ? { left: 10, top: 10 } : { ...DEFAULT_CONFIG.offset }
  }

  /**
   * Attach camera controls to the axis helper
   * @param {object} cameraControls - The camera controls instance
   */
  attachControls(cameraControls) {
    this._cameraControls = cameraControls
    this._gizmo.attachControls(cameraControls)
  }

  /**
   * Update the axis helper orientation
   */
  updateOrientation() {
    if (this._gizmo._updateOrientation) {
      this._gizmo._updateOrientation()
    }
  }

  /**
   * Render the axis helper
   */
  render() {
    this._gizmo.render()
    this._applyDomOverrides()
  }

  /**
   * Update the axis helper (typically called on window resize)
   */
  update() {
    if (this._usesResponsiveOffset) {
      const nextOffset = this._getResponsiveOffset()
      const currentOffset = this._options.offset
      if (nextOffset.left !== currentOffset.left || nextOffset.top !== currentOffset.top) {
        this._options = { ...this._options, offset: nextOffset }
        this._gizmo.set(this._buildConfig())
        this._applyDomOverrides()
        if (this._cameraControls) {
          this._gizmo.attachControls(this._cameraControls)
        }
        this._setupAnisotropy()
      }
    }
    this._gizmo.update()
    this._applyDomOverrides()
  }

  /**
   * Set a custom render callback
   * @param {Function} callback - The render callback function
   */
  setRenderCallback(callback) {
    this._renderCallback = callback
  }

  /**
   * Customize the axis helper with new color options
   * @param {object} options - Color customization options
   * @param {number} options.faceColor - Color for the axis faces (hex value)
   * @param {number} options.labelColor - Color for the axis labels (hex value)
   * @param {number} options.backgroundColor - Background color (hex value)
   * @param {number} options.borderColor - Border color (hex value)
   * @param {number} options.hoverColor - Hover color (hex value)
   * @param {number} options.hoverLabelColor - Hover label color (hex value)
   * @param {number} options.hoverBorderColor - Hover border color (hex value)
   */
  customize(options = {}) {
    // Update internal colors
    this._colors = {
      FACE: options.faceColor ?? this._colors.FACE,
      LABEL: options.labelColor ?? this._colors.LABEL,
      BACKGROUND: options.backgroundColor ?? this._colors.BACKGROUND,
      BORDER: options.borderColor ?? this._colors.BORDER,
      HOVER: options.hoverColor ?? this._colors.HOVER,
      HOVER_LABEL: options.hoverLabelColor ?? this._colors.HOVER_LABEL,
      HOVER_BORDER: options.hoverBorderColor ?? this._colors.HOVER_BORDER,
    }

    // Update the gizmo with new configuration
    this._gizmo.set(this._buildConfig())
    this._applyDomOverrides()

    // Reattach controls if they exist
    if (this._cameraControls) {
      this._gizmo.attachControls(this._cameraControls)
    }

    // Update anisotropy for new materials
    this._setupAnisotropy()

    // Render the updated gizmo
    this._renderScene()
  }

  /**
   * Get the underlying ViewportGizmo instance
   * @returns {ViewportGizmo} The gizmo instance
   */
  get gizmo() {
    return this._gizmo
  }

  /**
   * Get the children of the gizmo (for material access)
   * @returns {Array} Array of child objects
   */
  get children() {
    return this._gizmo.children
  }

  /**
   * Add event listener to the gizmo
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  addEventListener(event, callback) {
    this._gizmo.addEventListener(event, callback)
  }

  /**
   * Remove event listener from the gizmo
   * @param {string} event - Event name
   * @param {Function} callback - Event callback
   */
  removeEventListener(event, callback) {
    this._gizmo.removeEventListener(event, callback)
  }

  /**
   * Dispose of the axis helper and clean up resources
   */
  dispose() {
    if (this._gizmo) {
      this._gizmo.dispose()
      this._gizmo = null
    }
    this._cameraControls = null
    this._renderCallback = null
  }
}
