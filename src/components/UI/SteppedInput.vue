<script setup>
const props = defineProps({
  step: {
    type: Number,
    default: 5,
  },
})

const model = defineModel()
</script>

<template>
  <InputNumber
    v-model="model" show-buttons button-layout="horizontal" :step="props.step" :pt="{
      root: {
        class: ' !h-8 rounded-md bg-transparent dark:bg-black/50 w-full max-w-24',
      },
      pcInputText: {
        root: 'min-w-0 text-center font-light !text-xs h-full !border-none !p-0 !shadow-none',
      },
      incrementbutton: {
        class: '!border-none !w-6 shadow-none',

      },
      decrementbutton: {
        class: '!border-none !w-6 shadow-none',
      },
    }"
  >
    <template #incrementicon>
      <span class="icon-[lucide--plus]" />
    </template>
    <template #decrementicon>
      <span class="icon-[lucide--minus]" />
    </template>
  </InputNumber>
</template>
