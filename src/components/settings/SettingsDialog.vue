<script setup>
import { computed, markRaw, onBeforeUnmount, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import AppearanceSettings from './AppearanceSettings.vue'

const visible = defineModel('visible', { type: Boolean, default: false })
const { t } = useI18n()

const categories = [
  { id: 'texture', labelKey: 'features.settings.categories.texture', icon: 'icon-[lucide--palette]', component: markRaw(AppearanceSettings) },
]

const MIN_WIDTH = 640
const MIN_HEIGHT = 420
const DEFAULT_WIDTH = 780
const DEFAULT_HEIGHT = 560

const activeCategory = shallowRef('texture')
const activeComponent = shallowRef(markRaw(AppearanceSettings))
const dialogSize = shallowRef({
  width: DEFAULT_WIDTH,
  height: DEFAULT_HEIGHT,
})

let resizeStart = null

function selectCategory(cat) {
  activeCategory.value = cat.id
  activeComponent.value = cat.component
}

const dialogStyle = computed(() => ({
  width: `${dialogSize.value.width}px`,
  height: `${dialogSize.value.height}px`,
  maxWidth: '95vw',
  maxHeight: '90vh',
}))

function stopResizing() {
  resizeStart = null
  window.removeEventListener('mousemove', handleResize)
  window.removeEventListener('mouseup', stopResizing)
}

function handleResize(event) {
  if (!resizeStart)
    return

  const maxWidth = Math.floor(window.innerWidth * 0.95)
  const maxHeight = Math.floor(window.innerHeight * 0.9)
  const nextWidth = resizeStart.width + (event.clientX - resizeStart.x)
  const nextHeight = resizeStart.height + (event.clientY - resizeStart.y)

  dialogSize.value = {
    width: Math.min(Math.max(nextWidth, MIN_WIDTH), maxWidth),
    height: Math.min(Math.max(nextHeight, MIN_HEIGHT), maxHeight),
  }
}

function startResizing(event) {
  if (event.button !== 0)
    return

  event.preventDefault()
  event.stopPropagation()

  resizeStart = {
    x: event.clientX,
    y: event.clientY,
    width: dialogSize.value.width,
    height: dialogSize.value.height,
  }

  window.addEventListener('mousemove', handleResize)
  window.addEventListener('mouseup', stopResizing)
}

onBeforeUnmount(() => {
  stopResizing()
})
</script>

<template>
  <Dialog
    v-model:visible="visible"
    :modal="false"
    :draggable="true"
    :closable="false"
    :style="dialogStyle"
    :pt="{
      root: { class: '!border-0 !overflow-hidden !rounded-2xl' },
      header: { class: '!px-6 !py-4 !border-b !border-zinc-200 dark:!border-zinc-800 !bg-zinc-100 dark:!bg-neutral-900 !cursor-move !select-none' },
      content: { class: '!p-0 !bg-zinc-100 dark:!bg-neutral-900 !h-full' },
    }"
  >
    <template #header>
      <div class="flex items-center justify-between w-full">
        <h2 class="text-base font-semibold">
          {{ t('features.settings.title') }}
        </h2>
        <Button
          text
          icon="icon-[lucide--x]"
          :pt="{ root: { class: '!size-8' }, icon: { class: '!text-base' } }"
          @click="visible = false"
        />
      </div>
    </template>

    <div class="relative flex h-[calc(100%-57px)] min-h-0">
      <nav class="w-44 shrink-0 border-r border-zinc-200 dark:border-zinc-800 py-2 px-2">
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="flex items-center gap-2 w-full px-3 py-1.5 rounded-md text-sm transition-colors"
          :class="activeCategory === cat.id
            ? 'bg-zinc-300/60 dark:bg-zinc-700/60 text-zinc-900 dark:text-zinc-100'
            : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-800/50'"
          @click="selectCategory(cat)"
        >
          <span :class="cat.icon" class="text-base" />
          <span>{{ t(cat.labelKey) }}</span>
        </button>
      </nav>

      <div class="flex-1 overflow-y-auto p-6">
        <component :is="activeComponent" />
      </div>

      <button
        class="absolute bottom-0 right-0 h-4 w-4 cursor-se-resize"
        :aria-label="t('features.settings.resizeDialog')"
        @mousedown="startResizing"
      >
        <span class="absolute bottom-1 right-1 h-2.5 w-2.5 border-b-2 border-r-2 border-zinc-400 dark:border-zinc-500" />
      </button>
    </div>
  </Dialog>
</template>
