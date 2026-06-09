<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { computed, inject, ref } from 'vue'

// nexis digital-twin collision detection (Problem 1) — live results list.
// Detection runs automatically (on add/move/building changes); the global
// safety gap ε lives in the right sidebar. Built to scale: filter chips + a
// virtual-scrolled list so thousands of findings stay responsive.

defineProps({
  // The floating wrapper renders its own header, so allow hiding the inline one.
  showHeader: { type: Boolean, default: true },
})

const ROW_HEIGHT = 50
const MAX_VISIBLE_ROWS = 8

const three = inject('three')
const collisionStore = useCollisionStore()
const { results, intersectCount, nearCount, hasCollisions } = storeToRefs(collisionStore)

const filter = ref('all') // 'all' | 'intersect' | 'near'

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

const buildingCount = computed(() => results.value.filter(r => r.kind === 'building').length)

const filteredResults = computed(() => {
  if (filter.value === 'all')
    return sortedResults.value
  if (filter.value === 'building')
    return sortedResults.value.filter(r => r.kind === 'building') // intersect + near
  return sortedResults.value.filter(r => r.status === filter.value)
})

const listHeight = computed(() =>
  Math.min(Math.max(filteredResults.value.length, 1), MAX_VISIBLE_ROWS) * ROW_HEIGHT,
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

const chips = computed(() => [
  { key: 'all', label: '全部', count: results.value.length, active: 'bg-zinc-200/15 text-zinc-100' },
  { key: 'intersect', label: '干涉', count: intersectCount.value, active: 'bg-red-500/20 text-red-300' },
  { key: 'near', label: '接近', count: nearCount.value, active: 'bg-amber-500/20 text-amber-300' },
  { key: 'building', label: '與建築', count: buildingCount.value, active: 'bg-sky-500/20 text-sky-300' },
])

// Exact CSG intersection volume per pair, computed on demand (clicking a row).
const exactByKey = ref({})
const pairKey = pair => `${pair.aUuid}|${pair.bUuid}`

function focusPair(pair) {
  three?.selectModelByUuid?.(pair.aUuid)
  // True Magnitude: exact intersection volume + the intersection region overlay.
  if (pair.status === 'intersect') {
    const r = three?.computeExactMagnitude?.(pair.aUuid, pair.bUuid)
    if (r)
      exactByKey.value = { ...exactByKey.value, [pairKey(pair)]: r.volume }
  }
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

    <template v-if="hasCollisions">
      <!-- filter chips -->
      <div class="flex items-center gap-1.5">
        <button
          v-for="c in chips"
          :key="c.key"
          type="button"
          class="rounded-full px-2 py-0.5 text-[11px] transition-colors"
          :class="filter === c.key ? c.active : 'text-zinc-400 hover:text-zinc-200'"
          @click="filter = c.key"
        >
          {{ c.label }} {{ c.count }}
        </button>
      </div>

      <!-- virtual-scrolled results -->
      <VirtualScroller
        :items="filteredResults"
        :item-size="ROW_HEIGHT"
        class="w-full"
        :style="{ height: `${listHeight}px` }"
      >
        <template #item="{ item: pair }">
          <div
            data-testid="collision-row"
            class="mb-1 cursor-pointer rounded-md border px-2 py-1.5"
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
                <template v-if="pair.status !== 'intersect'">間隙 {{ fmtNum(pair.gap) }} cm</template>
                <template v-else-if="exactByKey[pairKey(pair)] != null">體積 {{ fmtNum(exactByKey[pairKey(pair)]) }} (精確)</template>
                <template v-else>體積 {{ fmtNum(pair.magnitude) }} (近似)</template>
              </span>
            </div>
            <div class="text-[10px] text-zinc-500">位置 {{ fmtLoc(pair.location) }}</div>
          </div>
        </template>
      </VirtualScroller>
    </template>

    <div v-else class="text-xs text-zinc-500">
      移動或擺放物件時即時偵測干涉；安全間隙於右側設定。
    </div>
  </div>
</template>
