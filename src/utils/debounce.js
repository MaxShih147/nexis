/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce
 * @param {number} wait The number of milliseconds to delay
 * @returns {Function} Returns the new debounced function
 */
export function debounce(func, wait) {
  let timeout

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds.
 * The throttled function will run at the start of the wait period.
 * @param {Function} func The function to throttle
 * @param {number} wait The number of milliseconds to throttle invocations to
 * @returns {Function} Returns the new throttled function
 */
export function throttle(func, wait) {
  let lastRun = 0
  let timeout

  return function executedFunction(...args) {
    const now = Date.now()

    if (lastRun && now < lastRun + wait) {
      // If the function is being called before the wait period is up,
      // schedule it to run after the wait period
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        lastRun = now
        func(...args)
      }, wait)
    }
    else {
      // If enough time has passed, run the function immediately
      lastRun = now
      func(...args)
    }
  }
}
