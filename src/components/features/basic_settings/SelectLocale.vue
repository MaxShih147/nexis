<script setup>
import Trans from '@/i18n/translation'
import { ref, watch } from 'vue'

const locales = [
  { label: 'EN', value: 'en' },
  { label: '繁中', value: 'tw' },
  { label: '簡中', value: 'cn' },
  { label: '日文', value: 'jp' },
]

const language = ref(locales.find(l => l.value === Trans.currentLocale) ?? locales[0])

watch(language, (selected) => {
  Trans.switchLanguage(selected.value)
})
</script>

<template>
  <Select
    v-model="language"
    :options="locales"
    option-label="label"
    placeholder="EN"
    size="small"
    class="flex justify-between items-center w-16"
    :pt="{
      root: {
        class: '!border-none !bg-transparent !shadow-none',
        style: {
          '--p-select-focus-ring-color': '#3f3f46',
        },
      },
      label: {
        style: {
          paddingInline: '4px 0px',
        },
      },
      dropdown: {
        class: 'flex justify-center items-center pe-1',
        style: {
          width: 'fit-content',
        },
      },
    }"
  >
    <template #dropdownicon>
      <span class="icon-[lucide--chevron-down]" />
    </template>
  </Select>
</template>
