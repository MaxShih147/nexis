<script setup>
import { useDarkMode } from '@/composables/useDarkMode'
import { applyThreeTheme } from '@/utils/theme'
import { inject, watch } from 'vue'

const three = inject('three')
const { isDark, toggleDarkMode } = useDarkMode()

function syncSceneTheme(isDarkMode) {
  applyThreeTheme(three, isDarkMode)
}

watch(isDark, syncSceneTheme, { immediate: true })
</script>

<template>
  <aside class="panel text-sm overflow-hidden">
    <!-- panel header: theme toggle only (export hidden) -->
    <div class="flex items-center py-2 px-1">
      <Button text :icon="isDark ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'" @click="toggleDarkMode" />
    </div>
    <!-- end of panel header -->
    <!-- panel body: building generation + global safety gap only -->
    <div class="flex-1 overflow-y-auto no-scrollbar">
      <BuildingPanel />
      <VDivider />
      <SafetyGapPanel />
      <VDivider />
      <ScatterPanel />
    </div>
    <!-- end of panel body -->
  </aside>
</template>
