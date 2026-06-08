<script setup>
import { useDarkMode } from '@/composables/useDarkMode'
import { useAuthStore } from '@/stores/useAuthStore'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const authStore = useAuthStore()
const { isDark, toggleDarkMode } = useDarkMode()

const navLinkClass
  = 'flex size-12 items-center justify-center rounded-xl text-zinc-500 transition-all duration-150 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'

const navLinkActiveClass
  = 'bg-zinc-900 text-white hover:bg-zinc-900 hover:!text-white dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-800 dark:hover:!text-white'

const navItems = computed(() => [
  {
    to: '/user/dashboard',
    label: t('common.labels.dashboard'),
    icon: 'icon-[lucide--layout-dashboard]',
  },
  {
    to: '/user/print-records',
    label: t('features.auth.userNav.printRecords'),
    icon: 'icon-[lucide--file-text]',
  },
  {
    to: '/user/account',
    label: t('features.auth.userNav.account'),
    icon: 'icon-[tabler--user]',
  },
])

function logout() {
  authStore.logout()
}
</script>

<template>
  <aside
    class="flex items-center border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:h-[100svh] lg:min-h-[100svh] lg:flex-col lg:border-r lg:border-b-0 lg:sticky lg:top-0 lg:self-start"
  >
    <RouterLink
      to="/"
      class="flex h-16 w-16 shrink-0 items-center justify-center border-r border-zinc-200 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-900 lg:w-full lg:border-r-0 lg:border-b"
      :aria-label="t('common.labels.slicer')"
    >
      <span class="icon-[lucide--layers] text-2xl" />
    </RouterLink>

    <nav class="flex flex-1 items-center gap-2 px-4 py-3 lg:flex-col lg:px-0 lg:py-4">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        :class="navLinkClass"
        :active-class="navLinkActiveClass"
        :aria-label="item.label"
        :title="item.label"
      >
        <span class="text-xl" :class="[item.icon]" aria-hidden="true" />
      </RouterLink>
    </nav>

    <div
      class="flex flex-col items-center gap-2 border-l border-zinc-200 px-4 py-3 dark:border-zinc-800 lg:flex-col lg:border-l-0 lg:border-t lg:px-0 lg:py-4"
    >
      <Button
        text
        :aria-label="isDark ? 'Light mode' : 'Dark mode'"
        :icon="isDark ? 'icon-[lucide--moon]' : 'icon-[lucide--sun]'"
        :pt="{
          root: {
            class: '!size-12 !rounded-xl !text-zinc-500 hover:!bg-zinc-100 hover:!text-zinc-900 dark:!text-zinc-400 dark:hover:!bg-zinc-900 dark:hover:!text-zinc-100',
          },
          icon: {
            class: '!text-xl',
          },
        }"
        @click="toggleDarkMode"
      />

      <Button
        text
        :aria-label="t('common.actions.logout')"
        icon="icon-[lucide--log-out]"
        :pt="{
          root: {
            class: '!size-12 !rounded-xl !text-zinc-500 hover:!bg-zinc-100 hover:!text-zinc-900 dark:!text-zinc-400 dark:hover:!bg-zinc-900 dark:hover:!text-zinc-100',
          },
          icon: {
            class: '!text-xl',
          },
        }"
        @click="logout"
      />
    </div>
  </aside>
</template>
