<script setup>
import ToolbarButton from '@/components/UI/ToolbarButton.vue'
import { useModelStore } from '@/stores/model'
import { useGeneralStore } from '@/stores/state'
import { useUndoStore } from '@/stores/useUndoStore'
import { storeToRefs } from 'pinia'
import { computed, inject, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// nexis: 3D-printing prep tools removed (auto-orientation, ortho processing,
// text emboss, base generation, drill, hollow). Only generic viewer/edit tools
// remain: undo/redo, model import, and transform modes (drag/rotate/translate/scale).

const state = useGeneralStore()
const undoStore = useUndoStore()
const modelStore = useModelStore()
const { models } = storeToRefs(modelStore)
const three = inject('three', null)
const toolbarRoot = ref(null)
const { t } = useI18n()

const hasModels = computed(() => models.value.length > 0)

const undoTooltip = computed(() =>
  undoStore.undoLabel
    ? `${t('common.labels.undo')}: ${t(undoStore.undoLabel)}`
    : t('common.labels.undo'),
)
const redoTooltip = computed(() =>
  undoStore.redoLabel
    ? `${t('common.labels.redo')}: ${t(undoStore.redoLabel)}`
    : t('common.labels.redo'),
)

function handleUndo() {
  three?.undoManager?.undo()
}

function handleRedo() {
  three?.undoManager?.redo()
}

const tools = ref({
  basicControls: [
    { icon: 'icon-[tabler--pointer]', tooltipKey: 'common.tooltips.drag', mode: 'drag' },
    { icon: 'icon-[tabler--rotate-360]', tooltipKey: 'common.tooltips.rotateTool', mode: 'rotate' },
    { icon: 'icon-[tabler--arrows-move]', tooltipKey: 'common.tooltips.translate', mode: 'translate' },
    { icon: 'icon-[lucide--scaling]', tooltipKey: 'common.tooltips.scaleTool', mode: 'scale' },
  ],
})

onMounted(() => {
  if (three) {
    for (const tool of tools.value.basicControls) {
      tool.action = () => {
        three.setTransformMode(tool.mode)
      }
    }
  }
})
</script>

<template>
  <div ref="toolbarRoot" class="bg-white dark:bg-zinc-900 divide-zinc-200 dark:divide-zinc-800 md:rounded-lg w-full md:w-fit flex items-center justify-start md:justify-center p-2 overflow-x-auto no-scrollbar">
    <div class="flex items-center h-10 gap-2 w-max">
      <!-- Undo / Redo -->
      <ToolbarButton
        icon="icon-[tabler--arrow-back-up]"
        :tooltip="undoTooltip"
        :disabled="!undoStore.canUndo || undoStore.isExecuting"
        @click="handleUndo"
      />
      <ToolbarButton
        icon="icon-[tabler--arrow-forward-up]"
        :tooltip="redoTooltip"
        :disabled="!undoStore.canRedo || undoStore.isExecuting"
        @click="handleRedo"
      />
      <VDivider layout="vertical" />
      <UploadBtn />
      <VDivider layout="vertical" />
      <!-- Transform tools -->
      <ToolbarButton
        v-for="tool in tools.basicControls"
        :key="tool.icon"
        :icon="tool.icon"
        :tooltip="t(tool.tooltipKey)"
        :active="tool.mode === state.controlMode"
        :disabled="!hasModels"
        @click="tool.action"
      />
    </div>
  </div>
</template>
