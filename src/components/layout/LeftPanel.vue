<script setup>
import { useModelStore } from '@/stores/model'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const three = inject('three')
const showMenu = ref(false)
const projectName = ref('untitled')
const isEditingProjectName = ref(false)
const draftProjectName = ref('')
const projectNameInput = useTemplateRef('projectNameInput')
let unsubscribeFromProjectName = null
const isMacOS = (() => {
  const userAgentDataPlatform = navigator?.userAgentData?.platform?.toLowerCase?.() || ''
  const userAgent = navigator?.userAgent?.toLowerCase?.() || ''

  return userAgentDataPlatform.includes('mac') || userAgent.includes('mac')
})()


function runMenuCommand(label) {
  const pm = three?.projectManager
  if (!pm)
    return
  showMenu.value = false
  switch (label) {
    case 'new project':
      pm.newProject()
      break
    case 'open project':
      pm.open()
      break
    case 'save project':
      pm.save()
      break
  }
}

const menuItemDefs = [
  { labelKey: 'common.labels.newProject', icon: 'icon-[lucide--plus]', command: () => runMenuCommand('new project') },
  { labelKey: 'common.labels.openProject', icon: 'icon-[lucide--folder]', shortcut: `${isMacOS ? '⌘' : 'Ctrl'}+O`, command: () => runMenuCommand('open project') },
  { labelKey: 'common.labels.saveProject', icon: 'icon-[lucide--save]', shortcut: `${isMacOS ? '⌘' : 'Ctrl'}+S`, command: () => runMenuCommand('save project') },
]

const menuItems = computed(() => menuItemDefs.map(d => ({ ...d, label: t(d.labelKey) })))

function syncProjectName() {
  projectName.value = three?.projectManager?.projectName || 'untitled'
}

async function startProjectNameEdit() {
  draftProjectName.value = projectName.value
  isEditingProjectName.value = true
  await nextTick()
  projectNameInput.value?.focus()
  projectNameInput.value?.select()
}

function commitProjectName() {
  three?.projectManager?.setProjectName(draftProjectName.value)
  syncProjectName()
  isEditingProjectName.value = false
}

function cancelProjectNameEdit() {
  draftProjectName.value = projectName.value
  isEditingProjectName.value = false
}

onMounted(() => {
  syncProjectName()
  const projectManager = three?.projectManager
  if (!projectManager?.subscribeToProjectName)
    return

  unsubscribeFromProjectName = projectManager.subscribeToProjectName((nextProjectName) => {
    projectName.value = nextProjectName
  })
})

onBeforeUnmount(() => {
  unsubscribeFromProjectName?.()
})
</script>

<template>
  <!-- left panel -->
  <aside class="panel text-sm">
    <!-- panel header -->
    <div class=" font-semibold flex items-center justify-between px-3 py-1">
      <h1 class="select-none">
        物件列表
      </h1>
      <!-- nexis: project menu (hamburger) temporarily hidden -->
    </div>
    <!-- end of panel header -->
    <!-- model list (scrolls when it overflows) -->
    <div class="flex-1 min-h-0 overflow-y-auto px-1">
      <ModelList v-if="modelStore.models.length > 0" />
      <div v-else class="flex flex-col items-center justify-center h-full gap-2">
        <UploadBtn label="新增物件" />
      </div>
    </div>
    <!-- end of model list -->
  </aside>
  <!-- end of left panel -->
</template>
