<template>
  <div class="flex w-full min-w-0 items-center gap-2 ps-2 text-xs">
    <div class="shrink-0">
      <slot name="start" />
    </div>
    <div class="min-w-0 flex-1">
      <slot name="mid">
        <div />
      </slot>
    </div>
    <div class="min-w-0 shrink-0">
      <slot name="end" />
    </div>
  </div>
</template>
