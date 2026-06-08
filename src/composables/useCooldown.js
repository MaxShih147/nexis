import { onBeforeUnmount, shallowRef } from 'vue'

export function useCooldown(durationSeconds) {
  const remaining = shallowRef(0)
  let intervalId = null

  function stop() {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }

    remaining.value = 0
  }

  function start() {
    stop()
    remaining.value = durationSeconds

    intervalId = setInterval(() => {
      remaining.value -= 1

      if (remaining.value <= 0)
        stop()
    }, 1000)
  }

  onBeforeUnmount(stop)

  return {
    remaining,
    start,
    stop,
  }
}
