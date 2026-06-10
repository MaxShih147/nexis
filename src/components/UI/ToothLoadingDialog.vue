<script setup>
import { PRIMARY_CSS } from '@/constants/theme.js'
import { ref, watch } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    required: true,
  },
  messages: {
    type: Array,
    default: () => ['Loading...'],
  },
})
defineEmits(['update:visible'])
const squareColor = PRIMARY_CSS.DEFAULT

const currentTextIndex = ref(0)
const fadeKey = ref(0)
let textInterval = null

function startInterval() {
  clearInterval(textInterval)
  textInterval = null
  if (props.messages.length > 1) {
    textInterval = setInterval(() => {
      currentTextIndex.value = (currentTextIndex.value + 1) % props.messages.length
      fadeKey.value++
    }, 3500)
  }
}

watch(() => props.visible, (val) => {
  if (val) {
    currentTextIndex.value = 0
    startInterval()
  }
  else {
    clearInterval(textInterval)
    textInterval = null
  }
})

watch(() => props.messages, () => {
  if (!props.visible)
    return
  currentTextIndex.value = 0
  fadeKey.value++
  startInterval()
}, { deep: true })
</script>

<template>
  <Dialog
    :visible="visible"
    modal
    :closable="false"
    :header="null"
    class="w-[280px]"
    :pt="{ header: { class: 'hidden' } }"
    @update:visible="$emit('update:visible', $event)"
  >
    <div class="flex flex-col items-center gap-6 py-8">
      <!-- Square-loop loader (Uiverse.io by ZacharyCrespin), tinted to the brand teal -->
      <div class="loader" :style="{ '--sq-color': squareColor }">
        <div class="loader-square" />
        <div class="loader-square" />
        <div class="loader-square" />
        <div class="loader-square" />
        <div class="loader-square" />
        <div class="loader-square" />
        <div class="loader-square" />
      </div>

      <Transition name="fade" mode="out-in">
        <p :key="fadeKey" class="text-sm font-medium tracking-widest text-zinc-400 uppercase">
          {{ messages[currentTextIndex] }}
        </p>
      </Transition>
    </div>
  </Dialog>
</template>

<style scoped>
/* Square-loop loader — Uiverse.io by ZacharyCrespin */
.loader {
  position: relative;
  width: 96px;
  height: 96px;
  transform: rotate(45deg);
}

.loader-square {
  position: absolute;
  top: 0;
  left: 0;
  width: 28px;
  height: 28px;
  margin: 2px;
  border-radius: 2px;
  background: var(--sq-color, #14b8a6);
  animation: square-animation 10s ease-in-out infinite both;
}

.loader-square:nth-of-type(1) { animation-delay: -1.4285714286s; }
.loader-square:nth-of-type(2) { animation-delay: -2.8571428571s; }
.loader-square:nth-of-type(3) { animation-delay: -4.2857142857s; }
.loader-square:nth-of-type(4) { animation-delay: -5.7142857143s; }
.loader-square:nth-of-type(5) { animation-delay: -7.1428571429s; }
.loader-square:nth-of-type(6) { animation-delay: -8.5714285714s; }
.loader-square:nth-of-type(7) { animation-delay: -10s; }

@keyframes square-animation {
  0%    { left: 0;    top: 0; }
  10.5% { left: 0;    top: 0; }
  12.5% { left: 32px; top: 0; }
  23%   { left: 32px; top: 0; }
  25%   { left: 64px; top: 0; }
  35.5% { left: 64px; top: 0; }
  37.5% { left: 64px; top: 32px; }
  48%   { left: 64px; top: 32px; }
  50%   { left: 32px; top: 32px; }
  60.5% { left: 32px; top: 32px; }
  62.5% { left: 32px; top: 64px; }
  73%   { left: 32px; top: 64px; }
  75%   { left: 0;    top: 64px; }
  85.5% { left: 0;    top: 64px; }
  87.5% { left: 0;    top: 32px; }
  98%   { left: 0;    top: 32px; }
  100%  { left: 0;    top: 0; }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.4s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
