<script setup>
import { inject, reactive, ref } from 'vue'

// nexis digital-twin: procedural building shell controls.
// Generates random-but-reasonable walls + columns on the floor so we have a
// "building body" to test object-vs-building interference against.

const three = inject('three')

// All lengths in cm, areas in cm².
const params = reactive({
  rooms: 3,
  wallHeight: 260,
  wallThickness: 15,
  columnSize: 30,
  minRoomArea: 250000,
  maxRoomArea: 640000,
  doorWidth: 80,
  doorHeight: 200,
  minColumnSpacing: 400,
  seed: 1,
})

const summary = ref(null)

const fields = [
  { key: 'rooms', label: 'Rooms (隔間)', min: 1, max: 40, step: 1 },
  { key: 'wallHeight', label: 'Wall height 牆高 (cm)', min: 1, max: 1000, step: 10 },
  { key: 'columnSize', label: 'Column side 柱邊長 (cm)', min: 1, max: 200, step: 5 },
  { key: 'doorWidth', label: 'Door width 門寬 (cm)', min: 1, max: 400, step: 5 },
  { key: 'doorHeight', label: 'Door height 門高 (cm)', min: 1, max: 1000, step: 10 },
  { key: 'minColumnSpacing', label: 'Column spacing 柱間距 (cm)', min: 100, max: 2000, step: 50 },
  { key: 'minRoomArea', label: 'Min area (cm²)', min: 10000, max: 5000000, step: 10000 },
  { key: 'maxRoomArea', label: 'Max area (cm²)', min: 10000, max: 10000000, step: 10000 },
]

function generate() {
  const meta = three?.generateBuilding?.({ ...params })
  if (meta)
    summary.value = { rooms: meta.roomCount, walls: meta.wallCount, columns: meta.columnCount }
}

function randomize() {
  params.seed = Math.floor(Math.random() * 100000)
  generate()
}

function clearBuilding() {
  three?.clearBuilding?.()
  summary.value = null
}
</script>

<template>
  <div class="building-panel flex flex-col gap-3 px-2 py-3 text-sm">
    <div class="flex items-center justify-between">
      <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">Building</span>
      <span v-if="summary" class="text-xs text-emerald-400">
        {{ summary.rooms }} rooms · {{ summary.walls }} walls · {{ summary.columns }} cols
      </span>
    </div>

    <div class="grid grid-cols-2 gap-x-3 gap-y-2">
      <label v-for="f in fields" :key="f.key" class="flex flex-col gap-0.5">
        <span class="text-[10px] text-zinc-500">{{ f.label }}</span>
        <InputNumber
          v-model="params[f.key]"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :max-fraction-digits="0"
          size="small"
          :input-style="{ width: '100%', fontSize: '0.75rem' }"
        />
      </label>
    </div>

    <div class="flex items-center gap-2">
      <Button
        size="small"
        class="flex-1 !text-xs"
        label="Generate"
        icon="icon-[lucide--building-2]"
        @click="generate"
      />
      <Button
        size="small"
        severity="secondary"
        class="!text-xs"
        label="Randomize"
        icon="icon-[lucide--dices]"
        @click="randomize"
      />
      <Button
        size="small"
        text
        class="!text-xs"
        label="Clear"
        @click="clearBuilding"
      />
    </div>
    <div class="text-[10px] text-zinc-500">
      Seed {{ params.seed }} — same seed + params reproduces the same layout.
    </div>
  </div>
</template>
