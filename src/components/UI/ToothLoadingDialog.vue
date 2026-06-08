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
const strokeOuter = PRIMARY_CSS.DEFAULT
const strokeInner = PRIMARY_CSS.LIGHT

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
      <svg class="tooth-svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          class="tooth-outer"
          :style="{ stroke: strokeOuter }"
          pathLength="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M12 4.321a5.444 5.444 0 0 0-9 4.123c0 3.633.02 7.042 2.089 10.283A3 3 0 0 0 11 18c0-.172.022-.264.038-.305c.01-.028.017-.033.023-.038l.001-.001c.041-.033.255-.156.938-.156s.897.123.938.156c.007.006.014.01.024.039A.9.9 0 0 1 13 18a3 3 0 0 0 5.911.727C20.98 15.487 21 12.079 21 8.447m0 0v-.002a5.445 5.445 0 0 0-9-4.124"
        />
        <path
          class="tooth-inner"
          :style="{ stroke: strokeInner }"
          pathLength="1"
          stroke-linecap="round"
          stroke-linejoin="round"
          d="M8.444 5A3.444 3.444 0 0 0 5 8.444c0 3.758.066 6.622 1.863 9.342l.116.176l.035.208A1 1 0 0 0 9 18c0-.66.17-1.391.813-1.906c.584-.467 1.37-.594 2.187-.594s1.603.127 2.187.594C14.83 16.61 15 17.34 15 18a1 1 0 0 0 1.986.17l.035-.208l.116-.176C18.934 15.066 19 12.204 19 8.447v-.003a3.445 3.445 0 0 0-5.727-2.58l1.257 1.887a1 1 0 1 1-1.664 1.109l-1.504-2.257l-.035-.056l-.127-.169A3.44 3.44 0 0 0 8.445 5"
        />
      </svg>

      <Transition name="fade" mode="out-in">
        <p :key="fadeKey" class="text-sm font-medium tracking-widest text-zinc-400 uppercase">
          {{ messages[currentTextIndex] }}
        </p>
      </Transition>
    </div>
  </Dialog>
</template>

<style scoped>
.tooth-svg {
  width: 88px;
  height: 88px;
}

.tooth-outer {
  stroke-width: 1;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-path 2.8s ease-in-out infinite;
}

.tooth-inner {
  stroke-width: 0.7;
  stroke-dasharray: 1;
  stroke-dashoffset: 1;
  animation: draw-path 2.8s ease-in-out infinite;
  animation-delay: 0.6s;
}

@keyframes draw-path {
  0%   { stroke-dashoffset: 1; opacity: 1; }
  50%  { stroke-dashoffset: 0; opacity: 1; }
  75%  { stroke-dashoffset: 0; opacity: 0.1; }
  99%  { stroke-dashoffset: 0; opacity: 0.1; }
  100% { stroke-dashoffset: 1; opacity: 0; }
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
