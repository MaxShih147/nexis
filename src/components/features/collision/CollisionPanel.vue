<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'

// nexis digital-twin collision detection (Problem 1) — live results list.
// Detection runs automatically (on add/move/building changes); the global
// safety gap ε lives in the right sidebar. This panel just shows the findings.

defineProps({
  // The floating wrapper renders its own header, so allow hiding the inline one.
  showHeader: { type: Boolean, default: true },
})

const three = inject('three')
const collisionStore = useCollisionStore()
const { results, intersectCount, nearCount, hasCollisions } = storeToRefs(collisionStore)

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
    return '無干涉'
  const parts = []
  if (intersectCount.value)
    parts.push(`${intersectCount.value} 干涉`)
  if (nearCount.value)
    parts.push(`${nearCount.value} 接近`)
  return parts.join(' · ')
})

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
  <div class="collision-panel flex flex-col gap-2 px-2 py-3 text-sm">
    <div v-if="showHeader" class="flex items-center justify-between">
      <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">碰撞</span>
      <span
        class="text-xs font-medium"
        :class="hasCollisions ? (intersectCount ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'"
      >{{ statusText }}</span>
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
            {{ pair.status === 'intersect' ? `體積 ${fmtNum(pair.magnitude)}` : `間隙 ${fmtNum(pair.gap)} cm` }}
          </span>
        </div>
        <div class="text-[10px] text-zinc-500">位置 {{ fmtLoc(pair.location) }}</div>
      </div>
    </div>
    <div v-else class="text-xs text-zinc-500">
      移動或擺放物件時即時偵測干涉；安全間隙於右側設定。
    </div>
  </div>
</template>
