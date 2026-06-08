<script setup>
import ToolbarButton from '@/components/UI/ToolbarButton.vue'
import { useToast } from '@/composables/useToast'
import { SINGLE_MODEL_MODE } from '@/constants/flags'
import { useModelStore, useProgressStore } from '@/stores/model'
import { computed, inject, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  icon: {
    type: Boolean,
    default: true,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  label: {
    type: String,
    default: '',
  },
  pt: {
    type: Object,
    default: () => ({}),
  },
})

const { t } = useI18n()
const modelStore = useModelStore()

const progressStore = useProgressStore()
const toast = useToast()

const three = inject('three', null)
const fileInput = ref(null)

const isDisabled = computed(() =>
  props.disabled || (SINGLE_MODEL_MODE && modelStore.models.length >= 1),
)

// Detect iOS devices (iPhone, iPad, iPod)
const isIOS = computed(() => {
  const userAgent = navigator.userAgent
  // Check for explicit iOS devices
  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return true
  }
  // Detect iPads on iOS 13+ (they report as Mac Safari with touch support)
  if (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1) {
    return true
  }
  return false
})

// Set accept attribute based on device
const acceptAttribute = computed(() => {
  return isIOS.value ? 'application/octet-stream' : '.stl'
})

function openFileDialog() {
  if (isDisabled.value)
    return
  // Reset so re-selecting the same file still fires @change
  fileInput.value.value = ''
  fileInput.value.click()
}

async function handleFileUpload(event) {
  const files = Array.from(event.target.files || [])
  // Reset so re-selecting the same file(s) still fires @change next time
  event.target.value = ''
  if (files.length === 0)
    return

  const valid = files.filter(f => f.name.split('.').pop().toLowerCase() === 'stl')
  if (valid.length < files.length)
    toast.error(t('common.messages.unsupportedFormat'), t('common.messages.stlOnly'))
  if (valid.length === 0)
    return

  progressStore.setLoading([
    t('notifications.progress.uploading'),
    t('common.messages.processingModel'),
    t('common.messages.almostThere'),
  ])
  try {
    // Batch import: the whole selection is packed together into free space,
    // without moving models already on the plate.
    await three.loadModels(valid)
  }
  finally {
    setTimeout(() => {
      progressStore.reset()
    }, 1000)
  }
}
</script>

<template>
  <ToolbarButton
    :icon="props.icon ? 'icon-[material-symbols--add]' : ''"
    :tooltip="t('common.tooltips.addModel')"
    :label="props.label"
    :disabled="isDisabled"
    @click="openFileDialog"
  />
  <input
    ref="fileInput"
    type="file"
    multiple
    :accept="acceptAttribute"
    :disabled="isDisabled"
    class="hidden"
    @change="handleFileUpload"
  >
</template>
