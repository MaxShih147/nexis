<script setup>
const props = defineProps({
  icon: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    default: '',
  },
  tooltip: {
    type: String,
    default: '',
  },
  active: {
    type: Boolean,
    default: false,
  },
  severity: {
    type: String,
    default: 'primary',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['click'])

function handleClick(event) {
  if (!props.disabled) {
    emit('click', event)
  }
}

function handleKeydown(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    handleClick(event)
  }
}
</script>

<template>
  <button
    type="button"
    role="button"
    :aria-label="tooltip"
    :aria-pressed="active"
    :disabled="disabled"
    :title="tooltip"
    class="p-1 flex items-center justify-center rounded-md transition-colors"
    :class="[
      disabled
        ? 'opacity-50 cursor-not-allowed'
        : 'cursor-pointer',
      active
        ? 'bg-primary-600 text-white'
        : 'text-zinc-900 dark:text-zinc-50 hover:bg-[#f5f5f5] dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-50',
    ]"
    @click="handleClick"
    @keydown="handleKeydown"
  >
    <div class="size-8 flex items-center justify-center">
      <span
        :class="[label ? 'size-4' : 'size-6', icon]"
        aria-hidden="true"
      />
    </div>
    <span v-if="label" class="text-sm pr-2">{{ label }}</span>
  </button>
</template>
