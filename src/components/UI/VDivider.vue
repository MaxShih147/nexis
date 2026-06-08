<script setup>
defineProps({
  layout: {
    type: String,
    default: 'horizontal',
    validator: value => ['horizontal', 'vertical'].includes(value),
  },
  styleClass: {
    type: String,
    default: 'bg-zinc-200 dark:bg-zinc-800',
  },
})
</script>

<template>
  <div
    :class="[
      layout === 'vertical' ? 'h-full w-px' : 'w-full h-px',
      styleClass,
    ]"
  />
</template>
