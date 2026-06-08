<script setup>
import SupportContactDialog from '@/components/dialogs/SupportContactDialog.vue'
import SettingsDialog from '@/components/settings/SettingsDialog.vue'
import { useModelStore } from '@/stores/model'
import { computed, inject, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const three = inject('three')
const showMenu = ref(false)
const showSupportDialog = ref(false)
const showSettings = ref(false)
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
  { labelKey: 'common.labels.contactUs', icon: 'icon-[lucide--life-buoy]', action: () => { showSupportDialog.value = true } },
  { labelKey: 'common.labels.settings', icon: 'icon-[lucide--settings]', action: () => { showSettings.value = true } },
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

const footerOptions = computed(() => footerOptionDefs.map(d => ({ ...d, label: t(d.labelKey) })))
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
      <h1
        v-if="!isEditingProjectName"
        data-testid="project-name-display"
        class="select-none cursor-text"
        @dblclick="startProjectNameEdit"
      >
        {{ projectName }}
      </h1>
      <input
        v-else
        ref="projectNameInput"
        v-model="draftProjectName"
        data-testid="project-name-input"
        class="min-w-0 flex-1 bg-transparent border-b border-zinc-400 outline-none"
        type="text"
        @blur="commitProjectName"
        @keydown.enter.prevent="commitProjectName"
        @keydown.esc.prevent="cancelProjectNameEdit"
      >
      <!-- <button class="flex items-center justify-center text-xl text-zinc-500 hover:text-zinc-50">
        <span class="icon-[lucide--align-justify]" @click="showMenu = !showMenu" />
      </button> -->
      <Button
        text icon="icon-[lucide--align-justify]" :pt="{
          root: {
            class: '!py-1',
          },
        }" @click="showMenu = !showMenu"
      />
      <div class="absolute z-50 left-60 top-0 ml-1 overflow-hidden transition-[width] duration-300" :style="{ width: showMenu ? '200px' : '0' }">
        <Menu :model="menuItems">
          <template #item="{ item, props }">
            <a v-ripple class="flex items-center gap-2 h-8 p-2 cursor-pointer" v-bind="props.action">
              <span :class="item.icon" />
              <span class="font-light select-none capitalize">{{ item.label }}</span>
              <span v-if="item.shortcut" class="ml-auto border border-zinc-700 rounded font-extralight text-xs p-1">{{ item.shortcut }}</span>
            </a>
          </template>
        </Menu>
      </div>
    </div>
    <!-- end of panel header -->
    <!-- model list -->
    <div class="h-full px-1">
      <ModelList v-if="modelStore.models.length > 0" />
      <div v-else class="flex flex-col items-center justify-center h-full gap-2">
        <span class="text-zinc-500 ">{{ t('common.messages.noModels') }}</span>
        <UploadBtn :label="t('common.actions.add')" />
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
  <SupportContactDialog v-model:visible="showSupportDialog" />
  <!-- end of left panel -->
  <SettingsDialog v-model:visible="showSettings" />
</template>
