<script setup>
import { useAuthStore } from '@/stores/useAuthStore'
import { displayAccountField, formatAccountFullName } from './accountDisplay'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const authStore = useAuthStore()

const fullName = computed(() => {
  return displayAccountField(formatAccountFullName(authStore.firstName, authStore.lastName))
})

const email = computed(() => displayAccountField(authStore.email))

const fieldClass = 'w-full border-zinc-200 bg-zinc-50 text-zinc-950 dark:border-white/10 dark:bg-zinc-950/60 dark:text-zinc-100'
const labelClass = 'text-sm font-medium text-zinc-700 dark:text-zinc-300'
</script>

<template>
  <section
    class="flex min-h-[calc(100svh-3rem)] w-full flex-col items-center justify-center px-4 py-8 lg:min-h-[calc(100svh-4rem)]"
  >
    <div class="w-full max-w-md">
      <p class="text-center text-[0.68rem] font-medium uppercase tracking-[0.18em] text-teal-400">
        {{ t('features.auth.account.eyebrow') }}
      </p>
      <h1 class="mt-3 text-center text-3xl font-medium text-zinc-950 dark:text-zinc-100">
        {{ t('features.auth.account.title') }}
      </h1>
      <p class="mt-3 text-center text-zinc-600 dark:text-zinc-400">
        {{ t('features.auth.account.subtitle') }}
      </p>

      <div class="mt-8 grid gap-6">
      <div class="grid gap-2">
        <label :class="labelClass" for="account-full-name">{{ t('features.auth.account.fullName') }}</label>
        <InputText
          id="account-full-name"
          :model-value="fullName"
          :class="fieldClass"
          readonly
        />
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="account-email">{{ t('features.auth.email') }}</label>
        <InputText
          id="account-email"
          :model-value="email"
          :class="fieldClass"
          type="email"
          readonly
        />
      </div>
      </div>
    </div>
  </section>
</template>
