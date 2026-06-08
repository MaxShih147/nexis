const allowedRoots = ['common', 'pages', 'features', 'domains', 'notifications', 'errors', 'validation', 'legacy']

const explicitPathMap = {
  'domains.printer.fields.machineName': 'domains.printer.fields.machineName',
  'domains.model.fields.size': 'domains.model.fields.size',
  'Mirror': 'domains.model.fields.mirrorMode',
  'M_BETWEEN': 'validation.range.between',
  'M_RETRACT_DERIVED_NEGATIVE': 'validation.range.retractDerivedNegative',
  'M_RETRACT_BOTH_ZERO': 'validation.range.retractBothZero',
}

const errorTokenPattern = /\b(?:ERROR|FAILED|INVALID|UNSUPPORTED|NOT|NO|CANNOT|MISMATCH|UNAVAILABLE|TIMEOUT|EXCEEDS?)\b/
const progressTokenPattern = /\b(?:LOADING|UPLOADING|PROCESSING|ANALYZING|CALCULATING|PACKING|DOWNLOADING|PREPARING|OPTIMIZING|PACKAGING|BROADCASTING|SLICING|GENERATING)\b/
const statusTokenPattern = /\b(?:SUCCESS|CONNECTED|UPLOADED|STARTED|PAUSED|RESUMED|STOPPED|COMPLETED|COMPLETE|GENERATED|REMOVED|RESTORED|FINISHED|APPLIED)\b/

function toWords(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-z0-9]+/gi, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

export function toCamelCase(value) {
  const [first = '', ...rest] = toWords(value)
  return [
    first.toLowerCase(),
    ...rest.map(segment => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()),
  ].join('')
}

function classifyLegacyMessage(rest) {
  if (errorTokenPattern.test(rest))
    return `errors.general.${toCamelCase(rest)}`
  if (progressTokenPattern.test(rest))
    return `notifications.progress.${toCamelCase(rest)}`
  if (statusTokenPattern.test(rest))
    return `notifications.status.${toCamelCase(rest)}`
  return `common.messages.${toCamelCase(rest)}`
}

export function legacyKeyToPath(key) {
  if (explicitPathMap[key])
    return explicitPathMap[key]

  if (key.startsWith('B_'))
    return `common.actions.${toCamelCase(key.slice(2))}`

  if (key.startsWith('T_'))
    return `common.tooltips.${toCamelCase(key.slice(2))}`

  if (key.startsWith('L_'))
    return `common.labels.${toCamelCase(key.slice(2))}`

  if (key.startsWith('M_'))
    return classifyLegacyMessage(key.slice(2))

  return `domains.legacy.${toCamelCase(key)}`
}

function toLegacyToken(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
}

export function pathToLegacyKey(path) {
  const segments = path.split('.')

  if (path === 'validation.range.between')
    return 'M_BETWEEN'

  if (path === 'validation.range.retractDerivedNegative')
    return 'M_RETRACT_DERIVED_NEGATIVE'

  if (path === 'validation.range.retractBothZero')
    return 'M_RETRACT_BOTH_ZERO'

  if (path === 'domains.printer.fields.machineName')
    return 'Machine Name'

  if (path === 'domains.model.fields.size')
    return 'L_Size'

  if (path === 'domains.model.fields.mirrorMode')
    return 'Mirror'

  if (segments[0] === 'common' && segments[1] === 'actions')
    return `B_${toLegacyToken(segments.slice(2).join('.'))}`

  if (segments[0] === 'common' && segments[1] === 'tooltips')
    return `T_${toLegacyToken(segments.slice(2).join('.'))}`

  if (segments[0] === 'common' && segments[1] === 'labels')
    return `L_${toLegacyToken(segments.slice(2).join('.'))}`

  if (
    (segments[0] === 'common' && segments[1] === 'messages')
    || segments[0] === 'notifications'
    || segments[0] === 'errors'
  ) {
    const leaf = segments[segments.length - 1]
    return `M_${toLegacyToken(leaf)}`
  }

  return null
}

export function setValueAtPath(target, path, value) {
  const segments = path.split('.')
  let cursor = target

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value
      return
    }

    cursor[segment] ??= {}
    cursor = cursor[segment]
  })
}

export function getValueAtPath(target, path) {
  return path.split('.').reduce((value, segment) => value?.[segment], target)
}

export function flattenMessagePaths(value, prefix = '') {
  if (Array.isArray(value))
    return value.flatMap((item, index) => flattenMessagePaths(item, `${prefix}[${index}]`))

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nested]) =>
      flattenMessagePaths(nested, prefix ? `${prefix}.${key}` : key),
    )
  }

  return prefix ? [prefix] : []
}

export function createNestedMessages(flatMessages) {
  const nestedMessages = {}
  const collisions = []

  Object.entries(flatMessages).forEach(([legacyKey, message]) => {
    const path = legacyKeyToPath(legacyKey)
    const existingValue = getValueAtPath(nestedMessages, path)

    if (existingValue !== undefined && existingValue !== message) {
      collisions.push({ legacyKey, path })
      return
    }

    setValueAtPath(nestedMessages, path, message)
  })

  return { nestedMessages, collisions }
}

export function buildLocaleMessages(nestedMessages) {
  const messagesWithAliases = structuredClone(nestedMessages)

  flattenMessagePaths(nestedMessages).forEach((path) => {
    const legacyKey = pathToLegacyKey(path)
    if (!legacyKey)
      return
    messagesWithAliases[legacyKey] = getValueAtPath(nestedMessages, path)
  })

  return messagesWithAliases
}

export function isAllowedRoot(value) {
  return allowedRoots.includes(value)
}

export function getAllowedRoots() {
  return [...allowedRoots]
}
