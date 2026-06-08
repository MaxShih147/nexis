<script setup>
import { PRIMARY_CSS } from '@/constants/theme.js'
import { useModelStore } from '@/stores/model'
import { computed, inject, ref } from 'vue'

const three = inject('three')
const primaryColor = PRIMARY_CSS.DEFAULT
const modelStore = useModelStore()

// Per-model parameters popover (safety-gap override, etc.)
const paramsPopover = ref(null)
const activeUuid = ref('')
const activeName = ref('')

function openParams(node, event) {
  activeUuid.value = node.data
  activeName.value = node.label
  paramsPopover.value?.toggle(event)
}

// Multi-selection bound to the store's selectedUuids (source of truth).
// PrimeVue Tree (multiple mode + metaKeySelection) applies the Cmd/Ctrl/Shift
// logic itself; we map node keys (= model index) ↔ model uuids.
const selectionKeys = computed({
  get() {
    const keys = {}
    modelStore.models.forEach((model, index) => {
      if (modelStore.selectedUuids.includes(model.uuid))
        keys[index] = true
    })
    return keys
  },
  set(newKeys) {
    const uuids = Object.keys(newKeys || {})
      .filter(k => newKeys[k])
      .map(index => modelStore.models[Number(index)]?.uuid)
      .filter(Boolean)
    three.setSelectedModels(uuids)
  },
})

const nodes = computed(() => createNodes(modelStore.models))

function createNodes(arr) {
  const nodes = arr.map((model, index) => {
    return {
      key: index,
      label: model.name,
      data: model.uuid,
      children: [],
    }
  })
  return nodes
}
</script>

<template>
  <Tree
    id="model-list" v-model:selection-keys="selectionKeys" :value="nodes" selection-mode="multiple" :meta-key-selection="true" class="w-full" :pt="{
      nodeContent: (options) => ({
        class: '!text-zinc-900 dark:!text-zinc-50',
        style: [
          'border-width: 1px',
          {
            'border-color': options.context.selected ? PRIMARY_CSS.DEFAULT : 'transparent',
          }],
      }),
    }"
  >
    <template #default="{ node }">
      <div class="flex w-full items-center justify-between gap-2 pr-1">
        <span class="flex min-w-0 items-center gap-2">
          <span class="icon-[ph--cube] shrink-0" />
          <span class="truncate">{{ node.label }}</span>
        </span>
        <button
          type="button"
          class="shrink-0 text-zinc-400 hover:text-zinc-100"
          aria-label="模型參數"
          @click.stop="openParams(node, $event)"
        >
          <span class="icon-[lucide--sliders-horizontal] text-sm" />
        </button>
      </div>
    </template>
  </Tree>
  <Popover ref="paramsPopover">
    <ModelParamsPanel v-if="activeUuid" :uuid="activeUuid" :name="activeName" />
  </Popover>
</template>

<style scoped>
#model-list{
  --p-tree-padding: 0px;
  --p-tree-background: transparent;
  --p-tree-node-toggle-button-size: 0px;
  --p-tree-node-icon-selected-color: v-bind(primaryColor);
  --p-tree-node-selected-background: transparent;
}

/* Let the node content + label fill the row so the gear button right-aligns. */
#model-list :deep(.p-tree-node-content) {
  width: 100%;
}
#model-list :deep(.p-tree-node-label) {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
