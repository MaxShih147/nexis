<script setup>
import { PRIMARY_CSS } from '@/constants/theme.js'
import { useModelStore } from '@/stores/model'
import { computed, inject } from 'vue'

const three = inject('three')
const primaryColor = PRIMARY_CSS.DEFAULT
const modelStore = useModelStore()

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
      icon: 'icon-[ph--cube]',
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
  />
</template>

<style scoped>
#model-list{
  --p-tree-padding: 0px;
  --p-tree-background: transparent;
  --p-tree-node-toggle-button-size: 0px;
  --p-tree-node-icon-selected-color: v-bind(primaryColor);
  --p-tree-node-selected-background: transparent;
}
</style>
