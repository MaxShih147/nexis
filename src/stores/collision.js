import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Collision-detection state (nexis digital-twin).
 *
 * Phase 0/1 scope: a single fixed floor. Results are produced by the
 * three-layer CollisionManager and pushed here for the UI to render.
 * Each result: { aUuid, bUuid, aName, bName, status, magnitude, location }
 */
export const useCollisionStore = defineStore('collision', () => {
  /** @type {import('vue').Ref<Array>} current interference pairs */
  const results = ref([])
  /** global safety-gap threshold ε (cm). 0 → pure intersection mode. */
  const tolerance = ref(0)
  /** per-model safety-gap overrides: { [uuid]: number }. Absent → use global. */
  const modelGaps = ref({})
  /** true when the last scan hit the result cap and stopped early */
  const capped = ref(false)
  /** whether a scan is currently running (batch) */
  const checking = ref(false)
  /** timestamp string of the last run (set by the caller) */
  const lastRunAt = ref(null)

  const intersectCount = computed(() => results.value.filter(r => r.status === 'intersect').length)
  const nearCount = computed(() => results.value.filter(r => r.status === 'near').length)
  const collisionCount = computed(() => results.value.length)
  const hasCollisions = computed(() => results.value.length > 0)

  function setResults(next) {
    results.value = Array.isArray(next) ? next : []
  }

  /** Effective safety gap for a model: its override if set, else the global ε. */
  function effectiveGap(uuid) {
    const v = modelGaps.value[uuid]
    return typeof v === 'number' ? v : tolerance.value
  }

  function setModelGap(uuid, value) {
    if (value == null)
      delete modelGaps.value[uuid]
    else
      modelGaps.value[uuid] = value
    // reassign to trigger reactivity on the object
    modelGaps.value = { ...modelGaps.value }
  }

  function clear() {
    results.value = []
  }

  return {
    results,
    tolerance,
    modelGaps,
    capped,
    checking,
    lastRunAt,
    intersectCount,
    nearCount,
    collisionCount,
    hasCollisions,
    setResults,
    effectiveGap,
    setModelGap,
    clear,
  }
})
