<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { inject } from 'vue'

// Global safety gap ε (cm). Applies to every pair unless a model overrides it
// (per-model override lives in the left model list). 0 → pure intersection.
const three = inject('three')
const collisionStore = useCollisionStore()
const { tolerance } = storeToRefs(collisionStore)

function updateTolerance(value) {
  three?.setCollisionTolerance?.(Math.max(0, Number(value) || 0))
}
</script>

<template>
  <div class="flex flex-col gap-2 px-2 py-3">
    <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">安全間隙</span>
    <div class="flex flex-col gap-1">
      <span class="text-xs text-zinc-400">全域 ε</span>
      <InputNumber
        :model-value="tolerance"
        :min="0"
        :max-fraction-digits="2"
        :step="10"
        show-buttons
        button-layout="horizontal"
        suffix=" cm"
        size="small"
        fluid
        :input-style="{ fontSize: '0.75rem' }"
        @update:model-value="updateTolerance"
      />
    </div>
    <p class="text-[10px] text-zinc-500">
      個別模型可在左側清單覆寫；一對取較大者。
    </p>
  </div>
</template>
