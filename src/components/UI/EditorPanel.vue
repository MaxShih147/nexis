<script setup>
const props = defineProps({
  title: {
    type: String,
    required: true,
  },
  undoFn: {
    type: Function,
  },
})
</script>

<template>
  <div class="flex flex-col gap-2 overflow-clip">
    <!-- header -->
    <div class="flex justify-between">
      <div class="flex items-center gap-1">
        <h2 class=" capitalize">
          {{ props.title }}
        </h2>
        <button v-if="undoFn" class="size-8 flex items-center justify-center group" @click="undoFn">
          <span
            class="icon-[lucide--rotate-ccw] text-zinc-400 dark:group-hover:text-zinc-50 group-hover:text-zinc-900 transition-transform group-hover:rotate-[-360deg] duration-500"
          />
        </button>
      </div>
      <div class="flex items-center">
        <slot name="header-btn" />
      </div>
    </div>
    <!-- end of header -->
    <!-- body -->
    <div class="flex flex-col gap-2">
      <slot name="body" />
    </div>
    <!-- end of body -->
  </div>
</template>
