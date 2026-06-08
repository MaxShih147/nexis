<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'

// nexis digital-twin collision detection (Problem 1) — Phase 0/1/2 UI.
// Single fixed floor. A manual full-scan + realtime toggle (scenario 1), plus a
// safety-gap threshold ε (scenario 2): non-touching pairs closer than ε are
// flagged "near" with their exact minimum distance and a closest-point line.

const three = inject('three')
const collisionStore = useCollisionStore()
const { results, realtime, tolerance, intersectCount, nearCount, hasCollisions } = storeToRefs(collisionStore)

// Intersections first (red), then near pairs (orange) by ascending gap.
const sortedResults = computed(() =>
  [...results.value].sort((a, b) => {
    if (a.status !== b.status)
      return a.status === 'intersect' ? -1 : 1
    if (a.status === 'near')
      return a.gap - b.gap
    return b.magnitude - a.magnitude
  }),
)

const statusText = computed(() => {
  if (!hasCollisions.value)
    return 'Clear'
  const parts = []
  if (intersectCount.value)
    parts.push(`${intersectCount.value} hit`)
  if (nearCount.value)
    parts.push(`${nearCount.value} near`)
  return parts.join(' · ')
})

function runCheck() {
  three?.checkCollisions?.()
}

function toggleRealtime(value) {
  realtime.value = value
  three?.setRealtimeCollision?.(value)
}

function updateTolerance(value) {
  const v = Math.max(0, Number(value) || 0)
  tolerance.value = v
  three?.setCollisionTolerance?.(v)
}

function clearResults() {
  three?.clearCollisions?.()
}

function focusPair(pair) {
  three?.selectModelByUuid?.(pair.aUuid)
}

function fmtNum(v, digits = 2) {
  if (!v)
    return '0'
  if (Math.abs(v) < 1)
    return v.toFixed(3)
  if (Math.abs(v) < 1000)
    return v.toFixed(digits)
  return v.toExponential(2)
}

function fmtLoc(loc) {
  if (!loc)
    return '—'
  return `${loc.x.toFixed(1)}, ${loc.y.toFixed(1)}, ${loc.z.toFixed(1)}`
}
</script>

<template>
  <div class="collision-panel flex flex-col gap-3 px-2 py-3 text-sm">
    <div class="flex items-center justify-between">
      <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">Collision</span>
      <span
        class="text-xs font-medium"
        :class="hasCollisions ? (intersectCount ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'"
      >{{ statusText }}</span>
    </div>

    <div class="flex items-center gap-2">
      <Button
        size="small"
        severity="secondary"
        class="flex-1 !text-xs"
        label="Check Collisions"
        icon="icon-[lucide--scan-search]"
        @click="runCheck"
      />
      <Button
        v-if="hasCollisions"
        size="small"
        text
        class="!text-xs"
        label="Clear"
        @click="clearResults"
      />
    </div>

    <!-- Safety gap ε (scenario 2) -->
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-zinc-400">Safety gap ε</span>
      <InputNumber
        :model-value="tolerance"
        :min="0"
        :max-fraction-digits="2"
        :step="1"
        show-buttons
        button-layout="horizontal"
        suffix=" cm"
        size="small"
        class="w-28"
        :input-style="{ width: '3.5rem', fontSize: '0.75rem' }"
        @update:model-value="updateTolerance"
      />
    </div>

    <div class="flex items-center justify-between">
      <span class="text-xs text-zinc-400">Realtime (while dragging)</span>
      <ToggleSwitch :model-value="realtime" @update:model-value="toggleRealtime" />
    </div>

    <!-- Results -->
    <div v-if="hasCollisions" class="flex flex-col gap-1">
      <div
        v-for="(pair, idx) in sortedResults"
        :key="`${pair.aUuid}-${pair.bUuid}-${idx}`"
        class="rounded-md border px-2 py-1.5 cursor-pointer"
        :class="pair.status === 'intersect'
          ? 'border-red-500/30 bg-red-500/5 hover:bg-red-500/10'
          : 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10'"
        @click="focusPair(pair)"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="truncate text-xs text-zinc-200">{{ pair.aName }} ↔ {{ pair.bName }}</span>
          <span
            class="shrink-0 text-[10px]"
            :class="pair.status === 'intersect' ? 'text-red-300' : 'text-amber-300'"
          >
            {{ pair.status === 'intersect' ? `vol ${fmtNum(pair.magnitude)}` : `gap ${fmtNum(pair.gap)} cm` }}
          </span>
        </div>
        <div class="text-[10px] text-zinc-500">loc {{ fmtLoc(pair.location) }}</div>
      </div>
    </div>
    <div v-else class="text-xs text-zinc-500">
      Run a check, or set a safety gap ε to detect near-misses.
    </div>
  </div>
</template>
