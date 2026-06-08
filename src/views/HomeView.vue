<script setup>
import { useMultiSelect } from '@/composables/useMultiSelect'
import { useProjectShortcuts } from '@/composables/useProjectShortcuts'
import { useToast } from '@/composables/useToast'
import { useUndoRedo } from '@/composables/useUndoRedo'
import { SINGLE_MODEL_MODE } from '@/constants/flags'
import { logger } from '@/utils/logger'
import { onActivated, onMounted, onUnmounted, provide, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDragDropUpload } from '../composables/useDragDropUpload'
import { useModelStore, useProgressStore } from '../stores/model'
import { useGeneralStore } from '../stores/state'
import { createSceneCoordinator } from '../three/sceneCoordinator'

defineOptions({ name: 'HomeView' })

const toast = useToast()
const { t } = useI18n()
const modelStore = useModelStore()
/**
 * Reference to the Three.js scene coordinator
 * @type {object | null}
 */
const three = shallowRef(null)
const providedThree = new Proxy({}, {
  get(_target, key) {
    return three.value?.[key]
  },
  set(_target, key, value) {
    if (!three.value)
      return false

    three.value[key] = value
    return true
  },
})

/**
 * Reference to the DOM container for the 3D scene
 * @type {HTMLElement|null}
 */
const sceneContainer = ref(null)

/**
 * Indicates whether the scene has been created
 */
const sceneCreated = ref(false)
const isRightDrawerOpen = ref(false)

const progressStore = useProgressStore()
const generalStore = useGeneralStore()
const isMacOS = (() => {
  const userAgentDataPlatform = navigator?.userAgentData?.platform?.toLowerCase?.() || ''
  const userAgent = navigator?.userAgent?.toLowerCase?.() || ''

  return userAgentDataPlatform.includes('mac') || userAgent.includes('mac')
})()

// Undo/redo keyboard shortcuts (Cmd+Z / Cmd+Shift+Z)
useUndoRedo(() => three.value?.undoManager)
provide('three', providedThree)

// Project file keyboard shortcuts (Cmd+S / Cmd+O / Cmd+N)
useProjectShortcuts(() => three.value?.projectManager)

// Multi-select shortcut (Cmd+A / Ctrl+A → select all models)
useMultiSelect(() => three.value)

watch(() => generalStore.checkScene, (newVal) => {
  if (newVal) {
    three.value.addModelsToScene()
  }
})

/**
 * Initialize drag and drop upload functionality
 */
const {
  isOverDropZone,
  setupDropZone,
  clearFiles,
} = useDragDropUpload({
  onDrop: async (validFiles, newErrors) => {
    if (newErrors.length) {
      toast.error(t('common.messages.unsupportedFileFormat'), t('common.messages.onlyStlAnd3mfSupported'))
    }

    if (!validFiles.length || !three.value)
      return

    if (SINGLE_MODEL_MODE && modelStore.models.length >= 1) {
      toast.error(t('common.messages.modelLimitReached'), t('common.messages.onlyOneModelAllowed'))
      return
    }

    const projects = validFiles.filter(f => f.name.split('.').pop().toLowerCase() === '3mf')
    const stls = validFiles.filter(f => f.name.split('.').pop().toLowerCase() !== '3mf')

    // A project file replaces the scene; if any were dropped, load the first one.
    if (projects.length) {
      try {
        await three.value.projectManager.loadFile(projects[0])
        toast.success(t('common.messages.projectLoaded'), projects[0].name)
      }
      catch (err) {
        toast.error(t('common.messages.failedToLoadProject'), err?.message || String(err))
      }
    }

    // STL models: load all sequentially so free-spot placement avoids overlap.
    if (stls.length) {
      progressStore.setLoading([
        t('notifications.progress.uploading'),
        t('common.messages.processingModel'),
        t('common.messages.almostThere'),
      ])
      try {
        // Batch import: pack the dropped set together into free space.
        await three.value.loadModels(stls)
      }
      finally {
        setTimeout(() => {
          progressStore.reset()
        }, 1000)
      }
    }

    clearFiles()
  },
  allowedFileTypes: ['.stl', '.3mf'],
  // maxFileSize: 50 * 1024 * 1024, // 50MB limit
})

function handleDeleteKey(event) {
  const isDeleteKey = event.key === 'Delete'
  const isMacDeleteShortcut = isMacOS && event.key === 'Backspace' && event.metaKey

  if (!isDeleteKey && !isMacDeleteShortcut)
    return

  if (!modelStore.selectedModel?.uuid)
    return

  try {
    if (isMacDeleteShortcut)
      event.preventDefault()

    three.value.removeModel(modelStore.selectedModel.uuid)
  }
  catch (error) {
    logger.error(error)
    toast.error(t('common.messages.failedToRemoveModel'))
  }
}

function toggleRightDrawer() {
  isRightDrawerOpen.value = !isRightDrawerOpen.value
}

/**
 * Initialize the 3D scene when the component is mounted
 */
onMounted(() => {
  // Initialize the scene coordinator
  three.value = createSceneCoordinator(sceneContainer.value)

  // Start rendering
  three.value.render()

  // Set up drag and drop on the scene container
  setupDropZone(sceneContainer.value)

  // Mark scene as created
  sceneCreated.value = true

  document.addEventListener('keydown', handleDeleteKey)
})

onActivated(() => {
  // Trigger resize so renderer/camera update after keep-alive reactivation
  window.dispatchEvent(new Event('resize'))
  three.value?.render()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleDeleteKey)
})
</script>

<template>
  <main class="relative min-h-[100svh] w-full no-scrollbar h-[100svh]">
    <!-- Left panel container - only shown when scene is ready -->
    <div v-if="sceneCreated" class="hidden md:block p-4 absolute max-h-[100svh] h-full">
      <LeftPanel />
    </div>

    <!-- 3D Scene container with drag and drop indicator -->
    <div
      ref="sceneContainer"
      class="absolute inset-0"
    >
      <div v-if="isOverDropZone" class="absolute inset-0 border-dashed border-indigo-500 bg-indigo-500 bg-opacity-5 flex items-center justify-center z-10 pointer-events-none">
        <div class="bg-black bg-opacity-70 rounded-lg p-8 text-center text-white">
          <i class="pi pi-upload text-5xl mb-4" />
          <p>{{ t('common.messages.drop3DModelToLoad') }}</p>
        </div>
      </div>
    </div>

    <!-- Right panel container - only shown when scene is ready -->
    <div v-if="sceneCreated">
      <div class="hidden md:flex p-4 absolute gap-4 right-0 max-h-[100svh] h-full">
        <ClippingPlane class="py-10" />
        <RightPanel />
      </div>
      <div class="flex md:hidden fixed right-10 top-80 bottom-20">
        <ClippingPlane class=" h-full" />
      </div>
      <div
        class="fixed md:hidden top-0 right-0 bottom-12 p-4 flex gap-4 max-h-[100svh] transition-transform duration-300 z-40"
        :class="isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'"
      >
        <RightPanel />
      </div>
      <button
        v-if="sceneCreated"
        class="md:hidden fixed right-0 top-1/2 -translate-y-1/2 z-50 bg-white/90 dark:bg-zinc-900/90 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-l-md h-12 w-6 flex items-center justify-center"
        type="button"
        :aria-label="isRightDrawerOpen ? t('common.tooltips.closePanel') : t('common.tooltips.openPanel')"
        @click="toggleRightDrawer"
      >
        <span class="text-xs">{{ isRightDrawerOpen ? '>' : '<' }}</span>
      </button>
    </div>

    <!-- Mobile model list -->
    <div
      v-if="sceneCreated && modelStore.models.length > 0"
      class="md:hidden fixed left-3 bottom-20 z-40 w-48 max-h-48 rounded-md bg-white/90 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur"
    >
      <div class="max-h-48 overflow-y-auto px-1 py-1">
        <ModelList />
      </div>
    </div>

    <!-- Model toolbar at the bottom -->
    <ModelToolbar v-if="sceneCreated" class="fixed md:absolute z-50 bottom-0 left-0 right-0 mx-auto mb-0 md:mb-4 px-3 pb-3" />
    <CollisionFloatingPanel v-if="sceneCreated" />
    <ToothLoadingDialog v-model:visible="progressStore.showProgress" :messages="progressStore.messages" />
  </main>
</template>
