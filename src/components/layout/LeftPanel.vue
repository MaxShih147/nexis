<script setup>
import AboutDialog from '@/components/dialogs/AboutDialog.vue'
import { useModelStore } from '@/stores/model'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const three = inject('three')
const showMenu = ref(false)
const showAbout = ref(false)
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

const footerOptionDefs = [
  { label: '關於', icon: 'icon-[lucide--info]', action: () => { showAbout.value = true } },
]

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

const footerOptions = computed(() => footerOptionDefs.map(d => ({ ...d, label: d.label ?? t(d.labelKey) })))
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
    <!-- model list -->
    <div class="h-full px-1">
      <ModelList v-if="modelStore.models.length > 0" />
      <div v-else class="flex flex-col items-center justify-center h-full gap-2">
        <UploadBtn label="新增物件" />
      </div>
    </div>
    <!-- end of model list -->
    <!-- panel footer -->
    <div class="flex flex-col justify-center py-1">
      <Menu
        :model="footerOptions" :pt="{
          root: {
            class: '!border-none capitalize',
          },
          itemIcon: {
            class: '!dark:text-zinc-50 capitalize',
          },
        }"
      >
        <template #item="{ item, props }">
          <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
            <a v-ripple :href="href" v-bind="props.action" @click="navigate">
              <span :class="item.icon" />
              <span class="ml-2">{{ item.label }}</span>
            </a>
          </router-link>
          <a v-else v-ripple class="p-menu-item-link" @click="item.action?.()">
            <span :class="item.icon" />
            <span class="ml-2">{{ item.label }}</span>
          </a>
        </template>
      </Menu>
    </div>
    <!-- end of panel footer -->
  </aside>
  <!-- end of left panel -->
  <AboutDialog v-model:visible="showAbout" />
</template>
