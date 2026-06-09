<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, ref } from 'vue'
import CollisionPanel from './CollisionPanel.vue'

// Floating, draggable collision panel — overlays the viewport instead of being
// locked into the narrow right sidebar.

const collisionStore = useCollisionStore()
const { intersectCount, nearCount, hasCollisions, capped } = storeToRefs(collisionStore)

const statusText = computed(() => {
  if (!hasCollisions.value)
    return '無干涉'
  const parts = []
  if (intersectCount.value)
    parts.push(`${intersectCount.value} 干涉`)
  if (nearCount.value)
    parts.push(`${nearCount.value} 接近`)
  return parts.join(' · ') + (capped.value ? '+' : '')
})

const pos = ref({ x: 296, y: 92 })
const collapsed = ref(false)

let dragging = false
let startX = 0
let startY = 0
let originX = 0
let originY = 0

function onPointerMove(e) {
  if (!dragging)
    return
  const nx = originX + (e.clientX - startX)
  const ny = originY + (e.clientY - startY)
  pos.value = {
    x: Math.max(0, Math.min(window.innerWidth - 120, nx)),
    y: Math.max(0, Math.min(window.innerHeight - 48, ny)),
  }
}

function onPointerUp() {
  dragging = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

function onPointerDown(e) {
  dragging = true
  startX = e.clientX
  startY = e.clientY
  originX = pos.value.x
  originY = pos.value.y
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

onBeforeUnmount(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div
    class="fixed z-40 w-96 select-none rounded-lg border border-zinc-200/10 bg-white/85 shadow-xl backdrop-blur dark:bg-zinc-900/85"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
  >
    <!-- drag handle -->
    <div
      class="flex cursor-move items-center justify-between rounded-t-lg border-b border-zinc-200/10 px-3 py-1.5"
      @pointerdown="onPointerDown"
    >
      <span class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
        <span class="icon-[lucide--grip-vertical] text-sm" />
        碰撞偵測
      </span>
      <div class="flex items-center gap-2">
        <span
          class="text-[11px] font-medium"
          :class="hasCollisions ? (intersectCount ? 'text-red-400' : 'text-amber-400') : 'text-emerald-400'"
        >{{ statusText }}</span>
        <button
          type="button"
          class="text-zinc-400 hover:text-zinc-100"
          :aria-label="collapsed ? '展開' : '收合'"
          @click="collapsed = !collapsed"
        >
          <span :class="collapsed ? 'icon-[lucide--chevron-down]' : 'icon-[lucide--chevron-up]'" />
        </button>
      </div>
    </div>

    <div v-show="!collapsed" class="max-h-[60vh] overflow-y-auto no-scrollbar">
      <CollisionPanel :show-header="false" />
    </div>
  </div>
</template>
