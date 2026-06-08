<script setup>
import { RouterView } from 'vue-router'
</script>

<template>
  <main class="grid min-h-[100svh] bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100 lg:grid-cols-[4.5rem_minmax(0,1fr)]">
    <UserSidebarShell />
    <section class="min-w-0 p-6 lg:p-8">
      <RouterView />
    </section>
  </main>
</template>
