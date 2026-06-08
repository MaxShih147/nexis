<script setup>
import { inject, ref, watch } from 'vue'

const value = ref(100)
const three = inject('three')

watch(value, (newValue) => {
  if (three) {
    three.clip(newValue)
  }
}, { immediate: true })
</script>

<template>
  <div>
    <Slider v-model="value" orientation="vertical" class="h-full absolute" :min="1" :max="100" />
  </div>
</template>
