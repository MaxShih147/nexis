import { healthCheck } from '@/axios/backendService'
import { DENTAL_MODE_SUPPORT_DEFAULTS } from '@/constants/supportDefaults'
import { useParamsStore } from '@/stores/useParamsStore'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

// Job status constants
export const JobStatus = {
  CREATED: 'created',
  READY: 'ready',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
}

const JOB_TYPES = ['support', 'hollow', 'slicing']

export const useBackendStore = defineStore('backend', () => {
  const paramsStore = useParamsStore()
  // Server status
  const serverStatus = ref({
    available: false,
    checking: false,
    lastChecked: null,
    version: null,
    capabilities: [],
  })

  // Dialog control
  const showServerDialog = ref(false)

  // Job tracking (per operation type)
  const jobs = ref({
    support: {
      id: null,
      modelId: null,
      status: null,
    },
    hollow: {
      id: null,
      modelId: null,
      status: null,
    },
    slicing: {
      id: null,
      modelId: null,
      status: null,
    },
  })

  // Ortho result source (for model reuse optimization — skip re-upload)
  const orthoResultSource = ref({
    modelId: null,
    jobId: null,
  })

  // Support state tracking
  const supportState = ref({
    hasSupportMesh: false,
    supportMeshId: null,
  })

  // Ortho processing config
  const orthoProcessingConfig = ref({
    hollowing_min_thickness: 3.0,
    hollowing_quality: 0.5,
    hollowing_closing_distance: 2.0,
    extension_distance: 10.0,
    bottom_z_threshold: 0.5,
    hex_cell_radius: 5.0,
    hex_wall_thickness: 1.0,
    hex_pyramid_height: 3.0,
    hex_grid_count: 10,
    drain_hole_radius: 1.5,
  })

  // Support config (synced with backend params)
  const supportConfig = ref({
    pad_enable: true,
    support_head_front_diameter: 0.4,
    support_head_penetration: 0.2,
    support_pillar_diameter: 1.0,
    support_points_density_relative: 100,
    support_critical_angle: 45,
  })

  function resetSupportConfigToDefaults(mode) {
    const defaults = DENTAL_MODE_SUPPORT_DEFAULTS[mode]
    if (defaults)
      Object.assign(supportConfig.value, defaults)
  }

  watch(() => paramsStore.dentalMode, resetSupportConfigToDefaults, { immediate: true })

  // Computed: effective mode based on server availability
  const effectiveMode = computed(() =>
    serverStatus.value.available ? 'backend' : 'frontend',
  )

  /**
   * Check backend server health
   * @returns {Promise<boolean>} Whether server is available
   */
  async function checkHealth() {
    serverStatus.value.checking = true
    try {
      const data = await healthCheck()
      serverStatus.value.available = true
      serverStatus.value.lastChecked = Date.now()
      serverStatus.value.version = data?.version || null
      serverStatus.value.capabilities = data?.capabilities || []
      showServerDialog.value = false
      return true
    }
    catch {
      serverStatus.value.available = false
      serverStatus.value.lastChecked = Date.now()
      showServerDialog.value = true
      return false
    }
    finally {
      serverStatus.value.checking = false
    }
  }

  /**
   * Initialize the store - one-shot health check at app startup.
   * No periodic polling; subsequent failures are detected reactively by
   * the slicer axios interceptor (see src/axios/axios.js).
   */
  function init() {
    checkHealth()
  }

  // ========== Job Management ==========

  /**
   * Get job for a specific operation type
   * @param {'support' | 'hollow' | 'slicing'} type - Operation type
   */
  function getJob(type) {
    return jobs.value[type]
  }

  /**
   * Check if a new job should be created for the operation
   * @param {'support' | 'hollow' | 'slicing'} type - Operation type
   * @param {string} currentModelId - Current model's ID
   * @returns {boolean} Whether a new job should be created
   */
  function shouldCreateNewJob(type, currentModelId) {
    const job = jobs.value[type]
    return !job.id || job.modelId !== currentModelId
  }

  /**
   * Set job info for a specific operation type
   * @param {'support' | 'hollow' | 'slicing'} type - Operation type
   * @param {object} jobInfo - Job info to set
   */
  function setJob(type, jobInfo) {
    jobs.value[type] = {
      ...jobs.value[type],
      ...jobInfo,
    }
  }

  /**
   * Update job status
   * @param {'support' | 'hollow' | 'slicing'} type - Operation type
   * @param {string} status - New status
   */
  function updateJobStatus(type, status) {
    jobs.value[type].status = status
  }

  /**
   * Clear job for a specific operation type
   * @param {'support' | 'hollow' | 'slicing'} type - Operation type
   */
  function clearJob(type) {
    jobs.value[type] = {
      id: null,
      modelId: null,
      status: null,
    }
  }

  /**
   * Clear all jobs associated with a model
   * @param {string} modelId - Model ID
   */
  function clearJobsForModel(modelId) {
    for (const type of JOB_TYPES) {
      const jobModelId = jobs.value[type].modelId
      // Match exact id OR composite id containing this model's uuid
      if (jobModelId === modelId || (jobModelId && jobModelId.includes(modelId)))
        clearJob(type)
    }
    if (orthoResultSource.value.modelId === modelId)
      clearOrthoResultSource()
  }

  // ========== Support State ==========

  /**
   * Update support state
   */
  function updateSupportState(updates) {
    Object.assign(supportState.value, updates)
  }

  /**
   * Clear support state
   */
  function clearSupportState() {
    supportState.value = {
      hasSupportMesh: false,
      supportMeshId: null,
    }
  }

  /**
   * Update support config
   */
  function updateSupportConfig(updates) {
    Object.assign(supportConfig.value, updates)
  }

  /**
   * Store the last boolean job ID from ortho processing (for model reuse)
   * @param {string} modelId - Model UUID
   * @param {string} jobId - Last boolean job ID on the backend
   */
  function setOrthoResultSource(modelId, jobId) {
    orthoResultSource.value = { modelId, jobId }
  }

  /**
   * Clear ortho result source
   */
  function clearOrthoResultSource() {
    orthoResultSource.value = { modelId: null, jobId: null }
  }

  /**
   * Update ortho processing config
   */
  function updateOrthoProcessingConfig(updates) {
    Object.assign(orthoProcessingConfig.value, updates)
  }

  return {
    // State
    serverStatus,
    showServerDialog,
    jobs,
    orthoResultSource,
    supportState,
    supportConfig,
    orthoProcessingConfig,

    // Computed
    effectiveMode,

    // Actions - Health check
    checkHealth,
    init,

    // Actions - Job management
    getJob,
    shouldCreateNewJob,
    setJob,
    updateJobStatus,
    clearJob,
    clearJobsForModel,

    // Actions - Support state
    updateSupportState,
    clearSupportState,
    updateSupportConfig,

    // Actions - Ortho processing
    setOrthoResultSource,
    clearOrthoResultSource,
    updateOrthoProcessingConfig,
  }
})
