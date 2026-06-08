<script setup>
import { useCollisionStore } from '@/stores/collision'
import { storeToRefs } from 'pinia'
import { computed, inject } from 'vue'

// Per-model parameters (the start of single-object settings). For now: a
// safety-gap override. If unset, the global ε applies; if set, this model uses
// its own value (a pair uses the larger of the two models' gaps).
const props = defineProps({
  uuid: { type: String, required: true },
  name: { type: String, default: 'model' },
})

const three = inject('three')
const collisionStore = useCollisionStore()
const { tolerance, modelGaps } = storeToRefs(collisionStore)

const hasOverride = computed(() => typeof modelGaps.value[props.uuid] === 'number')
const gapValue = computed(() => modelGaps.value[props.uuid] ?? tolerance.value)

function setOverride(enabled) {
  // Enable → seed from the current global ε; disable → fall back to global.
  three?.setModelCollisionTolerance?.(props.uuid, enabled ? tolerance.value : null)
}

function setValue(v) {
  three?.setModelCollisionTolerance?.(props.uuid, Math.max(0, Number(v) || 0))
}
</script>

<template>
  <div class="flex w-56 flex-col gap-3 p-1 text-sm">
    <div class="flex items-center gap-2">
      <span class="icon-[ph--cube] text-zinc-400" />
      <span class="truncate font-medium">{{ name }}</span>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <span class="text-xs text-zinc-400">自訂安全間隙</span>
        <ToggleSwitch :model-value="hasOverride" @update:model-value="setOverride" />
      </div>

      <div v-if="hasOverride" class="flex items-center justify-between gap-2">
        <span class="text-xs text-zinc-400">間隙</span>
        <InputNumber
          :model-value="gapValue"
          :min="0"
          :max-fraction-digits="2"
          :step="10"
          show-buttons
          button-layout="horizontal"
          suffix=" cm"
          size="small"
          class="w-32"
          :input-style="{ width: '3.5rem', fontSize: '0.75rem' }"
          @update:model-value="setValue"
        />
      </div>
      <p v-else class="text-[10px] text-zinc-500">
        使用全域安全間隙（{{ tolerance }} cm）
      </p>
    </div>
  </div>
</template>
