<script setup>
import { inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_MATCAP_ID, MATCAP_GROUPS } from './matcaps'

const three = inject('three')
const selectedId = ref(DEFAULT_MATCAP_ID)
const { t } = useI18n()

function selectMatcap(matcap) {
  selectedId.value = matcap.id
  three?.setMatcapTexture(matcap.urls)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div v-for="group in MATCAP_GROUPS" :key="group.labelKey">
      <h3 class="text-xs font-medium text-zinc-500 mb-2">
        {{ t(group.labelKey) }}
      </h3>
      <div class="grid grid-cols-6 gap-2">
        <button
          v-for="matcap in group.items"
          :key="matcap.id"
          class="flex items-center justify-center p-1 rounded-lg transition-all focus:outline-none"
          :class="selectedId === matcap.id
            ? 'bg-zinc-700/60 ring-2 ring-orange-500 scale-110'
            : 'hover:bg-zinc-800/50 hover:scale-105'"
          @click="selectMatcap(matcap)"
        >
          <img
            :src="matcap.thumb"
            :alt="matcap.id"
            class="size-12 rounded-full object-cover"
            loading="lazy"
          >
        </button>
      </div>
    </div>
  </div>
</template>
