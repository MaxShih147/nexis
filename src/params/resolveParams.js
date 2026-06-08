/**
 * resolveParams(defaultJson, resinJson?)
 * Stages: adapt (default→UI, resin→UI) → normalize (units already handled by transforms) →
 * merge (uiDefaults < default < resin) → validate (Zod)
 * Output: { ui, sourceInfo, errors? }
 */
import adapters from './adapters.js'
import { mergeOnWhitelist } from './merge'
import { validateUi } from './uiSchema'

export function resolveParams(defaultJson, resinJson) {
  const base = adapters.seededUiDefaults
  const asUiDefault = adapters.fromDefault(defaultJson || {})
  const asUiResin = resinJson ? adapters.fromResin(resinJson) : {}

  const { merged, sourceInfo } = mergeOnWhitelist([
    { source: 'ui-default', data: base },
    { source: 'default', data: asUiDefault },
    { source: 'resin', data: asUiResin },
  ])

  // Ensure schemaVersion present
  merged.schemaVersion = 1

  const result = validateUi(merged)
  if (!result.success) {
    return { ui: merged, sourceInfo, errors: result.error.issues }
  }
  return { ui: result.data, sourceInfo }
}
