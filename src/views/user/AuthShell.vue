<script setup>
import LeftIcon from '@/assets/svg/left.svg?raw'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
  <main class="relative min-h-[100svh] bg-stone-100 px-6 py-8 text-zinc-950 transition-colors dark:bg-black dark:text-zinc-50 sm:px-8 lg:px-10">
    <button
      type="button"
      class="absolute left-6 top-6 border-b border-transparent pb-px text-zinc-500/50 transition-all duration-200 hover:border-zinc-500 hover:text-zinc-500 dark:text-white/50 dark:hover:border-white dark:hover:text-white sm:left-8 sm:top-8"
      :aria-label="t('legacy.common.actions.back')"
      @click="router.push('/')"
      v-html="LeftIcon"
    />
    <section class="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-[34rem] items-center">
      <div class="auth-card-enter w-full rounded-[2rem] border border-zinc-200/80 bg-[rgba(255,255,255,0.92)] px-6 py-7 shadow-[0_24px_80px_rgba(15,23,42,0.08)] transition-colors dark:border-white/10 dark:bg-black sm:px-8 sm:py-8">
        <slot />
      </div>
    </section>
  </main>
</template>
