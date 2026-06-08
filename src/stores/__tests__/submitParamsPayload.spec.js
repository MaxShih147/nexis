import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'

import defaultProfile from '../../data/default_profiles/sonic_ls_plus.json'
import { resolveParams } from '../../params/resolveParams'
import { useParamsStore } from '../useParamsStore'

function shapeOf(value) {
  if (Array.isArray(value))
    return value.map(shapeOf)
  if (value !== null && typeof value === 'object') {
    const out = {}
    for (const k of Object.keys(value)) out[k] = shapeOf(value[k])
    return out
  }
  // Collapse all primitives to a sentinel to ignore values/types
  return '*'
}

describe('submitParams payload matches default profile', () => {
  it('produces identical JSON to sonic_4k_2022.json', () => {
    setActivePinia(createPinia())
    const store = useParamsStore()

    // Seed the store UI from the default profile (no resin, no user edits)
    const { ui } = resolveParams(defaultProfile, null)
    store.uiParams = ui

    const result = store.submitParams()
    expect(result.ok).toBe(true)

    // Compare structure only (keys/arrays/nesting), ignore primitive values
    const payloadShape = shapeOf(result.payload)
    const defaultShape = shapeOf(defaultProfile)
    expect(payloadShape).toStrictEqual(defaultShape)
  })
})
