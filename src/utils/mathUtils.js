/**
 * Rounds up a number based on specified conditions.
 * @param {number} num - The number to round up.
 * @param {boolean} [intMode] - If true, always round up to integer.
 * @returns {string|number} - The rounded number, potentially with 'k' suffix.
 */
function roundUpNumber(num, intMode = true) {
  if (!num)
    return 0
  if (num < 10000) {
    if (intMode) {
      return Math.ceil(num)
    }
    return Math.ceil(num * 100) / 100
  }

  const roundedNum = Math.ceil(num / 100) / 10
  return `${roundedNum.toFixed(1)}k`
}

/**
 * Converts radians to degrees
 * @param {number} rad - The angle in radians
 * @returns {number} The angle in degrees
 */
function radToDeg(rad) {
  return rad * 180 / Math.PI
}

/**
 * Converts degrees to radians
 * @param {number} deg - The angle in degrees
 * @returns {number} The angle in radians
 */
function degToRad(deg) {
  return deg * Math.PI / 180
}

export { degToRad, radToDeg, roundUpNumber }
