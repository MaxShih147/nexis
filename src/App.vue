<script setup>
import { RouterView } from 'vue-router'

// nexis: backend (web-slicer-core) intentionally not connected.
// Slicer/printer health-check polling and the server-status dialog are disabled.
</script>

<template>
  <DynamicDialog />
  <Toast />
  <RouterView v-slot="{ Component }">
    <keep-alive include="HomeView">
      <component :is="Component" />
    </keep-alive>
  </RouterView>
</template>
