import { defineStore } from 'pinia'
import { computed, reactive, ref } from 'vue'

const DEFAULT_LOADING_MESSAGES = ['Loading...']

/**
 * Store for managing 3D models in the application
 */
export const useModelStore = defineStore('model', () => {
  // Models collection
  const models = reactive([])

  // Selected model state
  const selectedModel = {
    name: ref(''),
    uuid: ref(''),
    isSelected: ref(false),
    position: reactive({ x: 0, y: 0, z: 0 }),
    rotation: reactive({ _x: 0, _y: 0, _z: 0 }),
    scale: reactive({ x: 1, y: 1, z: 1 }),
    dimensions: reactive({ width: 0, height: 0, length: 0 }),
    hollowed: ref(false),
    Object3D: null,
  }

  // Multi-selection set: uuids of all currently selected models. Order = selection
  // order; the last entry is the "primary" used by single-target ops + the gizmo.
  // `selectedModel` above mirrors the primary for existing single-select consumers.
  const selectedUuids = ref([])

  /**
   * Whether a model uuid is in the current multi-selection.
   * @param {string} uuid
   * @returns {boolean} true if selected
   */
  const isSelected = uuid => selectedUuids.value.includes(uuid)

  /**
   * Replace the multi-selection set.
   * @param {string[]} uuids
   */
  const setSelectedUuids = (uuids) => {
    selectedUuids.value = Array.isArray(uuids) ? [...uuids] : []
  }

  /**
   * Find a model by UUID
   * @param {string} uuid - Model UUID to find
   * @returns {object | undefined} The found model or undefined
   */
  const findModel = uuid => models.find(model => model.uuid === uuid)

  /**
   * Add a model to the store
   * @param {object} model - The 3D model to add
   * @param {string} name - The name of the model
   */
  const addModel = (model, name = 'Untitled') => {
    // Don't add duplicates
    if (findModel(model.uuid))
      return

    // Add model with immutable pattern
    models.push({ ...model, name })
  }

  /**
   * Update the selected model state with the given model
   * @param {object} model - The model to set as selected
   */
  const updateSelectedModelState = (model) => {
    selectedModel.name.value = model.name
    selectedModel.uuid.value = model.uuid
    selectedModel.Object3D = model
    selectedModel.isSelected.value = true

    // Use Object.assign for cleaner property copying
    Object.assign(selectedModel.position, model.position)
    Object.assign(selectedModel.rotation, model.rotation)
    Object.assign(selectedModel.scale, model.scale)
    Object.assign(selectedModel.dimensions, model.dimensions || {})

    // Set hollowed state
    selectedModel.hollowed.value = model.userData?.hollowed || false
  }

  /**
   * Select a model by UUID and update the selectedModel state
   * @param {string} uuid - UUID of the model to select
   */
  const selectModel = (uuid) => {
    const model = findModel(uuid)
    if (!model)
      return

    // Update selected model state
    updateSelectedModelState(model)
  }

  /**
   * Deselect the current model
   */
  const deselectModel = () => {
    selectedModel.name.value = ''
    selectedModel.uuid.value = ''
    selectedModel.Object3D = null
    selectedModel.isSelected.value = false
  }

  /**
   * Synchronize selected model state with its Object3D representation
   */
  const syncSelectedModel = () => {
    if (!selectedModel.Object3D)
      return

    const model = selectedModel.Object3D

    // Sync position, rotation, scale and dimensions
    Object.assign(selectedModel.position, model.position)
    Object.assign(selectedModel.rotation, model.rotation)
    Object.assign(selectedModel.scale, model.scale)
    Object.assign(selectedModel.dimensions, model.dimensions || {})

    // Sync hollowed state
    selectedModel.hollowed.value = model.userData?.hollowed || false
  }

  /**
   * Remove a model from the store by UUID
   * @param {string} uuid - UUID of the model to remove
   * @returns {boolean} True if model was found and removed, false otherwise
   */
  const removeModel = (uuid) => {
    const modelIndex = models.findIndex(model => model.uuid === uuid)

    if (modelIndex === -1)
      return false

    // If the model being removed is currently selected, deselect it
    if (selectedModel.uuid.value === uuid) {
      deselectModel()
    }
    // Drop it from the multi-selection set too
    if (selectedUuids.value.includes(uuid)) {
      selectedUuids.value = selectedUuids.value.filter(u => u !== uuid)
    }

    // Remove the model from the array
    models.splice(modelIndex, 1)
    return true
  }

  /**
   * Get model data for slicing operation
   * @returns {Array} Array of model data with positions and indices
   */
  const getModelsForSlice = () => models.map(model => ({
    id: model.uuid,
    positionArray: Array.from(model.geometry.attributes.position.array),
    indexArray: Array.from(model.geometry.index.array),
  }))

  /**
   * Clear all models from the store (used on scene re-initialization, e.g. HMR)
   */
  const clearAll = () => {
    models.splice(0, models.length)
    deselectModel()
    selectedUuids.value = []
  }

  return {
    models,
    selectedModel,
    selectedUuids,
    isSelected,
    setSelectedUuids,
    addModel,
    findModel,
    selectModel,
    deselectModel,
    syncSelectedModel,
    removeModel,
    getModelsForSlice,
    clearAll,
  }
})

/**
 * Store for managing progress indicators
 */
export const useProgressStore = defineStore('progress', () => {
  const progress = ref([])
  const showProgress = ref(false)
  const messages = ref([...DEFAULT_LOADING_MESSAGES])

  /**
   * Calculate the total progress as an average of all progress items
   */
  const totalProgress = computed(() => {
    if (progress.value.length === 0)
      return 0

    const sum = progress.value.reduce((total, value) => total + value, 0)
    return sum / progress.value.length
  })

  function setLoading(nextMessages = DEFAULT_LOADING_MESSAGES) {
    messages.value = [...nextMessages]
    showProgress.value = true
  }

  function reset() {
    showProgress.value = false
    progress.value.length = 0
    messages.value = [...DEFAULT_LOADING_MESSAGES]
  }

  return {
    progress,
    totalProgress,
    showProgress,
    messages,
    setLoading,
    reset,
  }
})
