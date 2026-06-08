<script setup>
const props = defineProps({
  title: {
    type: String,
    default: 'Profile Updated',
  },
  message: {
    type: String,
    default: '',
  },
  confirmLabel: {
    type: String,
    default: 'OK',
  },
  cancelLabel: {
    type: String,
    default: null,
  },
})

const emit = defineEmits(['confirm', 'cancel'])

const visible = defineModel('visible', { type: Boolean, default: false })

function onConfirm() {
  visible.value = false
  emit('confirm')
}

function onCancel() {
  visible.value = false
  emit('cancel')
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :header="props.title"
    :closable="false"
    class="w-[90vw] max-w-[360px]"
  >
    <div class="flex flex-col gap-4">
      <p class="text-sm text-zinc-500 dark:text-zinc-400">
        {{ props.message }}
      </p>
      <div class="flex justify-end gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
        <Button
          v-if="props.cancelLabel"
          :label="props.cancelLabel"
          severity="secondary"
          :pt="{ root: { class: '!text-sm !px-5 !py-2' } }"
          @click="onCancel"
        />
        <Button
          :label="props.confirmLabel"
          :pt="{ root: { class: '!text-sm !px-5 !py-2' } }"
          @click="onConfirm"
        />
      </div>
    </div>
  </Dialog>
</template>
