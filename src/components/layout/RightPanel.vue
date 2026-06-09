<script setup>
import AboutDialog from '@/components/dialogs/AboutDialog.vue'
import { useDarkMode } from '@/composables/useDarkMode'
import { applyThreeTheme } from '@/utils/theme'
import { inject, ref, watch } from 'vue'

const three = inject('three')
const { isDark, toggleDarkMode } = useDarkMode()
const showAbout = ref(false)

function syncSceneTheme(isDarkMode) {
  applyThreeTheme(three, isDarkMode)
}

watch(isDark, syncSceneTheme, { immediate: true })
</script>

<template>
  <aside class="panel text-sm overflow-hidden">
    <!-- panel header: theme toggle + about -->
    <div class="flex items-center gap-1 py-2 px-1">
      <Button text :icon="isDark ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'" @click="toggleDarkMode" />
      <Button text icon="icon-[lucide--info]" aria-label="關於" @click="showAbout = true" />
    </div>
    <!-- end of panel header -->
    <AboutDialog v-model:visible="showAbout" />
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
