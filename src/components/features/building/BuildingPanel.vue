<script setup>
import { inject, reactive, ref } from 'vue'

// nexis 數位孿生：程序化建築外殼控制面板。
// 在地板上生成隨機但合理的牆與柱，作為「建築本體」供物件干涉檢測使用。

const three = inject('three')

// 長度單位為公分 (cm)，面積為平方公分 (cm²)。
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
  { key: 'rooms', label: '隔間數', step: 1, min: 1, max: 40 },
  { key: 'wallHeight', label: '牆高 (cm)', step: 10, min: 1, max: 1000 },
  { key: 'columnSize', label: '柱邊長 (cm)', step: 5, min: 1, max: 200 },
  { key: 'minColumnSpacing', label: '柱間距 (cm)', step: 50, min: 100, max: 2000 },
  { key: 'doorWidth', label: '門寬 (cm)', step: 5, min: 1, max: 400 },
  { key: 'doorHeight', label: '門高 (cm)', step: 10, min: 1, max: 1000 },
  { key: 'minRoomArea', label: '最小面積 (cm²)', step: 10000, min: 10000, max: 5000000 },
  { key: 'maxRoomArea', label: '最大面積 (cm²)', step: 10000, min: 10000, max: 10000000 },
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
  <div class="building-panel flex flex-col gap-3 px-2 py-3">
    <div class="flex items-center justify-between">
      <span class="font-medium uppercase tracking-wide text-zinc-400 text-xs">建築</span>
      <span v-if="summary" class="text-xs text-emerald-400">
        {{ summary.rooms }} 房 · {{ summary.walls }} 牆 · {{ summary.columns }} 柱
      </span>
    </div>

    <div class="grid grid-cols-2 gap-x-2 gap-y-2.5">
      <label v-for="f in fields" :key="f.key" class="flex min-w-0 flex-col gap-1">
        <span class="truncate text-[11px] text-zinc-400">{{ f.label }}</span>
        <InputNumber
          v-model="params[f.key]"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :max-fraction-digits="0"
          size="small"
          fluid
          :pt="{ pcInputText: { root: { class: '!text-xs !py-1.5 w-full' } } }"
        />
      </label>
    </div>

    <div class="flex flex-col gap-2 pt-1">
      <Button
        size="small"
        fluid
        class="!text-xs"
        label="產生建築"
        icon="icon-[lucide--building-2]"
        @click="generate"
      />
      <div class="grid grid-cols-2 gap-2">
        <Button
          size="small"
          severity="secondary"
          outlined
          fluid
          class="!text-xs"
          label="隨機"
          icon="icon-[lucide--dices]"
          @click="randomize"
        />
        <Button
          size="small"
          severity="secondary"
          outlined
          fluid
          class="!text-xs"
          label="清除"
          icon="icon-[lucide--trash-2]"
          @click="clearBuilding"
        />
      </div>
    </div>

    <div class="text-[10px] text-zinc-500">
      種子 {{ params.seed }}（相同種子與參數會產生相同佈局）
    </div>
  </div>
</template>
