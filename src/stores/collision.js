import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Collision-detection state (nexis digital-twin, Problem 1).
 *
 * Phase 0/1 scope: a single fixed floor. Results are produced by the
 * three-layer CollisionManager and pushed here for the UI to render.
 * Each result: { aUuid, bUuid, aName, bName, status, magnitude, location }
 */
export const useCollisionStore = defineStore('collision', () => {
  /** @type {import('vue').Ref<Array>} current interference pairs */
  const results = ref([])
  /** live re-check while dragging/transforming */
  const realtime = ref(false)
  /** safety-gap threshold ε (scene units / mm). 0 → pure intersection mode. */
  const tolerance = ref(0)
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

  function clear() {
    results.value = []
  }

  return {
    results,
    realtime,
    tolerance,
    checking,
    lastRunAt,
    intersectCount,
    nearCount,
    collisionCount,
    hasCollisions,
    setResults,
    clear,
  }
})
