<script setup>
import { ORTHO_MODES } from '@/constants/orthoModes'
import { useParamsStore } from '@/stores/useParamsStore'
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const visible = defineModel('visible', { type: Boolean, default: true })

const { t } = useI18n()
const paramsStore = useParamsStore()
const selectedMode = ref(ORTHO_MODES[0])

function onConfirm() {
  if (!selectedMode.value)
    return
  paramsStore.applyResin({ __dental_mode: selectedMode.value }, { preserveUserEdits: false, markDirty: false })
  visible.value = false
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :closable="false"
    :header="t('common.labels.selectDentalMode')"
    class="w-[90vw] max-w-[420px]"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        {{ t('common.messages.chooseDentalModeDesc') }}
      </p>

      <div class="flex flex-col gap-2">
        <button
          v-for="mode in ORTHO_MODES"
          :key="mode"
          type="button"
          class="flex items-center gap-3 px-4 py-3 rounded-lg border text-sm transition-colors text-left"
          :class="selectedMode === mode
            ? 'border-primary-500 bg-primary-500/10 text-primary-600 dark:text-primary-400'
            : 'border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-zinc-500'"
          @click="selectedMode = mode"
        >
          <span
            class="size-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
            :class="selectedMode === mode ? 'border-primary-500' : 'border-zinc-400'"
          >
            <span v-if="selectedMode === mode" class="size-2 rounded-full bg-primary-500" />
          </span>
          {{ mode }}
        </button>
      </div>

      <div class="flex justify-end pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <Button
          :label="t('common.actions.continue')"
          :disabled="!selectedMode"
          :pt="{ root: { class: '!text-sm !px-5 !py-2' } }"
          @click="onConfirm"
        />
      </div>
    </div>
  </Dialog>
</template>
