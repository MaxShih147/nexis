<script setup>
import { useDarkMode } from '@/composables/useDarkMode'
import { useModelStore } from '@/stores/model'
import { applyThreeTheme } from '@/utils/theme'
import { computed, inject, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const three = inject('three')
const { isDark, toggleDarkMode } = useDarkMode()
const canExportProject = computed(() => Boolean(three?.projectManager) && modelStore.models.length > 0)

function syncSceneTheme(isDarkMode) {
  applyThreeTheme(three, isDarkMode)
}

watch(isDark, syncSceneTheme, { immediate: true })

async function handleExportClick() {
  if (!canExportProject.value)
    return

  try {
    await three.projectManager.save()
  }
  catch (error) {
    console.error('Failed to export project', error)
  }
}
</script>

<template>
  <aside class="panel text-sm overflow-hidden">
    <!-- panel header -->
    <div class="flex items-center justify-between py-2 px-1">
      <Button text :icon="isDark ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'" @click="toggleDarkMode" />
      <Button
        :label="t('common.actions.export')" severity="secondary" :pt="{
          root: {
            class: 'uppercase',
          },
          label: {
            class: '!text-xs',
          },
        }"
        :disabled="!canExportProject"
        @click="handleExportClick"
      />
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

<style scoped>
.right-panel__user-button {
  padding: 0.2rem;
  border: 1px solid rgb(255 255 255 / 0.08);
  background: rgb(255 255 255 / 0.04);
  transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
}

.right-panel__user-button:hover,
.right-panel__user-button:focus-visible {
  transform: translateY(-1px);
  border-color: rgb(45 212 191 / 0.4);
  box-shadow: 0 10px 24px rgb(20 184 166 / 0.14);
}

.right-panel__user-avatar {
  background: linear-gradient(135deg, rgb(45 212 191), rgb(13 148 136));
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
}
</style>
