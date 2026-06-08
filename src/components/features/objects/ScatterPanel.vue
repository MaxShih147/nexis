<script setup>
import { inject, ref } from 'vue'

// Test helper that simulates "system A" placing N objects: scatters random
// boxes across the floor so collision detection has something to chew on.
const three = inject('three')
const count = ref(20)

function scatter() {
  three?.scatterRandomObjects?.(count.value)
}

function clearAll() {
  three?.clearScene?.()
}
</script>

<template>
  <div class="flex flex-col gap-2 px-2 py-3">
    <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">物件（測試）</span>
    <div class="flex items-center justify-between gap-2">
      <span class="text-xs text-zinc-400">數量</span>
      <InputNumber
        v-model="count"
        :min="1"
        :max="5000"
        :step="10"
        :max-fraction-digits="0"
        size="small"
        class="w-28"
        :input-style="{ width: '3.5rem', fontSize: '0.75rem' }"
      />
    </div>
    <div class="flex flex-col gap-2">
      <Button size="small" fluid class="!text-xs" label="隨機生成物件" icon="icon-[lucide--dices]" @click="scatter" />
      <Button size="small" severity="secondary" outlined fluid class="!text-xs" label="清空物件" icon="icon-[lucide--trash-2]" @click="clearAll" />
    </div>
  </div>
</template>
