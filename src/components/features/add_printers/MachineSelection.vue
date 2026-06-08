<script setup>
import { usePrintersStore } from '@/stores/printers.js'
import { storeToRefs } from 'pinia'
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  selectedMachineIP: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['update:selectedMachineIP'])

const { t } = useI18n()
const printersStore = usePrintersStore()
const { nearbyPrinters, isSearching } = storeToRefs(printersStore)
const hasPrinters = computed(() => nearbyPrinters.value.length > 0)

const selectedMachine = computed(() => printersStore.getPrinter(props.selectedMachineIP))

// Watch for selectedMachine changes to trigger connection
watch(selectedMachine, (newMachine, oldMachine) => {
  if (newMachine && newMachine !== oldMachine) {
    printersStore.connectPrinter(newMachine)
  }
})

function getNearbyPrinters() {
  emit('update:selectedMachineIP', null)
  printersStore.getNearbyPrinters()
}

function updateSelectedMachine(value) {
  emit('update:selectedMachineIP', value)
}

onMounted(() => {
  getNearbyPrinters()
})
</script>

<template>
  <div>
    <div class="flex justify-between items-center">
      <label class="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">
        {{ t('common.labels.selectPrinter') }}
      </label>
      <button class="group p-2 text-sm text-gray-500 dark:text-zinc-400 cursor-pointer" @click="getNearbyPrinters">
        <span class=" group icon-[lucide--refresh-cw] group-hover:animate-spin group-hover:text-gray-700 dark:group-hover:text-zinc-50" />
      </button>
    </div>
    <Select
      :model-value="selectedMachineIP"
      :options="nearbyPrinters"
      option-label="name"
      option-value="ip"
      class="w-full"
      :placeholder="isSearching ? t('common.messages.searchingPrinters') : (!hasPrinters ? t('common.messages.noPrintersYet') : t('common.labels.selectAPrinter'))"
      :disabled="isSearching || !hasPrinters"
      @update:model-value="updateSelectedMachine"
    >
      <template #option="slotProps">
        <div class="flex flex-col">
          <span class="font-medium">{{ slotProps.option.name }}</span>
          <span class="text-sm text-gray-500 dark:text-zinc-400">{{ slotProps.option.ip }}</span>
        </div>
      </template>
      <template #optiongroup="slotProps">
        <div class="font-semibold text-xs uppercase tracking-wide text-gray-600 dark:text-zinc-400 px-2 py-1">
          {{ slotProps.option.label }}
        </div>
      </template>
    </Select>

    <!-- Connection Status -->
    <div :class="{ 'h-12': selectedMachine?.status !== 'error', 'h-3': !selectedMachine, 'h-20': selectedMachine?.status === 'error' }" class=" transition-all duration-300 items-center flex">
      <div
        v-if="selectedMachine"
        class="w-full"
      >
        <!-- Connected State -->
        <div v-if="selectedMachine.status === 'idle'" class="items-center flex justify-end gap-2">
          <span class="icon-[lucide--check-circle] text-green-800 dark:text-green-400" />
          <span class="text-sm text-green-800 dark:text-green-300">
            {{ t('common.actions.connected') }}
          </span>
        </div>
        <!-- Error State -->
        <div v-if="selectedMachine.status === 'error'" class="w-full  p-3 rounded-lg  border-red-200 border bg-red-50 dark:border-red-800 dark:bg-red-950 flex justify-between items-center gap-2">
          <div class="flex items-center gap-2">
            <span class="icon-[lucide--x-circle] text-red-600 dark:text-red-400" />
            <div class="flex flex-col">
              <span class="text-sm text-red-700 dark:text-red-300">
                {{ t('common.messages.connectionError') }}
              </span>
              <span class="text-xs text-red-600 dark:text-red-400 mt-1">
                {{ selectedMachine.error }}
              </span>
            </div>
          </div>

          <!-- Retry Button -->
          <button
            v-if="selectedMachine.status === 'error'"
            class="flex items-center gap-1 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            @click="printersStore.connectPrinter(selectedMachine)"
          >
            <span class="icon-[lucide--refresh-cw]" />
            {{ t('common.actions.retry') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
