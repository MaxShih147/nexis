<script setup>
const visible = defineModel('visible', { type: Boolean, default: false })

const features = [
  '即時偵測物件之間、以及物件與建築（牆、柱）的干涉',
  '標示干涉的位置（Location）與量化大小（深度 / 體積）',
  '安全間隙檢測：設定全域或逐物件的最小安全距離，找出雖未接觸卻過近的物件',
  '程序化生成建築外殼（牆、門、結構柱網）作為場域基準',
]
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    header="關於 nexis"
    :style="{ width: '34rem', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!border !border-zinc-200 dark:!border-zinc-700 !rounded-2xl' },
      content: { class: '!pt-0' },
    }"
  >
    <div class="flex flex-col gap-5 text-sm">
      <!-- 專案 -->
      <section>
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-50">
          專案
        </h3>
        <p class="mt-2 leading-6 text-zinc-500 dark:text-zinc-300">
          nexis 是一套面向大範圍數位孿生（Digital Twin）的碰撞／干涉檢測前端。
          場域中的物件與建築皆以三角網格（Mesh）表示，協助設計者驗證佈局是否可行：
        </p>
        <ul class="mt-3 flex list-disc flex-col gap-1.5 pl-5 leading-6 text-zinc-500 dark:text-zinc-300">
          <li v-for="f in features" :key="f">
            {{ f }}
          </li>
        </ul>
        <p class="mt-3 leading-6 text-zinc-400 dark:text-zinc-400">
          以 three.js + three-mesh-bvh 作為顯示與運算核心，純前端執行、無需後端。
        </p>
      </section>

      <!-- 作者 -->
      <section>
        <h3 class="font-semibold text-zinc-900 dark:text-zinc-50">
          作者
        </h3>
        <p class="mt-2 leading-6 text-zinc-500 dark:text-zinc-300">
          Max Shih — 此專案的設計與開發者。
        </p>
        <a
          href="https://github.com/MaxShih147"
          target="_blank"
          rel="noreferrer"
          class="mt-3 inline-flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
        >
          <span class="flex items-center gap-2">
            <span class="icon-[lucide--github] text-base" />
            github.com/MaxShih147
          </span>
          <span class="icon-[lucide--arrow-up-right] text-base" />
        </a>
      </section>
    </div>
  </Dialog>
</template>
