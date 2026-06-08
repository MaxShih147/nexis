<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const visible = defineModel('visible', { type: Boolean, default: false })
const { t } = useI18n()

const contactLinks = computed(() => [
  {
    label: t('common.labels.businessInquiry'),
    href: 'https://phrozen3d.com/pages/business-inquiry',
  },
  {
    label: t('common.labels.helpCenter'),
    href: 'https://helpcenter.phrozen3d.com/hc/en-us',
  },
])
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="t('common.labels.contactUs')"
    :style="{ width: '30rem', maxWidth: 'calc(100vw - 2rem)' }"
    :pt="{
      root: { class: '!border !border-zinc-200 dark:!border-zinc-700 !rounded-2xl' },
      content: { class: '!pt-0' },
    }"
  >
    <div>
      <p class="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        PHROZEN TECH CO., LTD.
      </p>
      <p class="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
        No. 130, Minzu Rd., Hukou Township, Hsinchu County 303001, Taiwan
      </p>
      <div class="mt-4 flex flex-col gap-2">
        <a
          v-for="link in contactLinks"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noreferrer"
          class="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-400 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white"
        >
          <span>{{ link.label }}</span>
          <span class="icon-[lucide--arrow-up-right] text-base" />
        </a>
      </div>
    </div>
  </Dialog>
</template>
