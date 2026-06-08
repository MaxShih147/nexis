export function formatAccountFullName(firstName, lastName) {
  const first = (firstName || '').trim()
  const last = (lastName || '').trim()

  if (!first && !last)
    return ''

  if (!first)
    return last

  if (!last)
    return first

  return `${first} ${last}`
}

export function displayAccountField(value) {
  const normalized = (value || '').trim()

  return normalized || '—'
}
