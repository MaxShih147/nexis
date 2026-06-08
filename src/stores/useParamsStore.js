import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { normalizeDentalModeLabel } from '../constants/orthoModes'
import adapters from '../params/adapters.js'
import { AA_UI_LEVELS, BLUR_UI_MAX, BLUR_UI_MIN, mappingUtils, uiWhitelist } from '../params/mappingTables'
import { mergeOnWhitelist } from '../params/merge'
import { resolveParams } from '../params/resolveParams'
import { validateUi } from '../params/uiSchema'

const { setByPath, getByPath } = mappingUtils

async function loadJson(relativePath) {
  const url = new URL(relativePath, import.meta.url)
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`Failed to load ${relativePath}`)
  return res.json()
}

export const useParamsStore = defineStore('params', () => {
  // State
  const uiParams = ref(null)
  const sourceInfo = ref(null)
  const dirty = ref(false)
  const profile = ref({ machineName: null, machineLabel: null, resinName: null })
  const schemaVersion = ref(1)
  const _rawDefaultJson = ref(null)
  const _rawResinJson = ref(null)

  // Getters
  const isValid = computed(() => {
    if (!uiParams.value)
      return false
    return validateUi(uiParams.value).success
  })

  const invalidReasons = computed(() => {
    if (!uiParams.value)
      return []
    const res = validateUi(uiParams.value)
    return res.success ? [] : res.error.issues.map(i => i.message)
  })

  const bedSize = computed(() => {
    const uiBed = uiParams.value?.machine?.bedSize
    const rawBed = _rawDefaultJson.value?.Machine?.bed_size
    const x = Number(uiBed?.x ?? rawBed?.[2] ?? 0)
    const y = Number(uiBed?.y ?? rawBed?.[3] ?? 0)
    return [
      Number.isFinite(x) ? x : 0,
      Number.isFinite(y) ? y : 0,
    ]
  })

  const buildHeight = computed(() => {
    const z = Number(_rawDefaultJson.value?.Machine?.machine_z ?? 0)
    return Number.isFinite(z) && z > 0 ? z : 200
  })

  const bedRatio = computed(() => {
    const [x, y] = bedSize.value
    return y !== 0 ? x / y : 1
  })

  const resolution = computed(() => {
    const uiResolution = uiParams.value?.machine?.resolution
    const rawResolution = _rawDefaultJson.value?.Machine?.image_size
    const x = Number(uiResolution?.x ?? rawResolution?.[0] ?? 0)
    const y = Number(uiResolution?.y ?? rawResolution?.[1] ?? 0)
    // Note: reversed order to match config.js convention [y, x]
    return [
      Number.isFinite(y) ? y : 0,
      Number.isFinite(x) ? x : 0,
    ]
  })

  const exportFileType = computed(() => {
    return _rawDefaultJson.value?.Other?.export_file_type || 'zip'
  })

  const previewImgResolution = computed(() => {
    const resolutions = _rawDefaultJson.value?.Other?.preview_img_resolution || []
    return resolutions.map(item => ({ width: item[0], height: item[1] }))
  })

  const printerModel = computed(() => {
    return _rawDefaultJson.value?.Machine?.machine_type || uiParams.value?.machine?.type || null
  })

  const dentalMode = computed(() =>
    normalizeDentalModeLabel(_rawResinJson.value?.__dental_mode),
  )

  // Actions
  function setResolvedParams({ defaultJson, resinJson, machineName, machineLabel }) {
    _rawDefaultJson.value = defaultJson
    _rawResinJson.value = resinJson
    profile.value.machineName = machineName ?? null
    profile.value.machineLabel = machineLabel ?? profile.value.machineLabel ?? null
    profile.value.resinName = resinJson?.profiles?.[0]?.resin_name ?? profile.value.resinName ?? null

    const { ui, sourceInfo: srcInfo } = resolveParams(defaultJson, resinJson)
    uiParams.value = ui
    sourceInfo.value = srcInfo
    dirty.value = false
  }

  async function loadParams(machineName) {
    // Read default and optional resin JSON from src/data
    const defaultJson = await loadJson(`../data/default_profiles/${machineName}.json`).catch(() => null)
    const resinJson = await loadJson(`../data/resin_profiles/${machineName}.json`).catch(() => null)

    const machineLabel = defaultJson?.Machine?.['domains.printer.fields.machineName']
      ? String(defaultJson.Machine['domains.printer.fields.machineName']).replace(/_/g, ' ')
      : machineName

    setResolvedParams({ defaultJson, resinJson, machineName, machineLabel })
  }

  function loadCustomMachine({ machineName, machineLabel, defaultJson, resinJson }) {
    setResolvedParams({
      defaultJson: defaultJson || null,
      resinJson: resinJson || null,
      machineName: machineName || null,
      machineLabel: machineLabel || machineName || 'Custom',
    })
  }

  function applyResin(resinJson, { preserveUserEdits = true, markDirty = true } = {}) {
    // Re-run pipeline with new resin layer
    const priorUi = uiParams.value || {}
    const priorSrc = sourceInfo.value || {}
    _rawResinJson.value = resinJson
    const { ui, sourceInfo: resinSrc } = resolveParams(_rawDefaultJson.value, resinJson)
    profile.value.resinName = resinJson?.profiles?.[0]?.resin_name ?? profile.value.resinName ?? null

    if (!preserveUserEdits) {
      // Replace any user edits with parameters from the new resin
      uiParams.value = ui
      sourceInfo.value = resinSrc
      dirty.value = markDirty
      return
    }

    // Preserve only fields that were actually edited by the user
    const userOnly = {}
    for (const path of uiWhitelist) {
      const src = getByPath(priorSrc, path)
      if (src === 'user') {
        const v = getByPath(priorUi, path)
        if (v !== undefined && v !== null && v !== '')
          setByPath(userOnly, path, v)
      }
    }
    const { merged, sourceInfo: mergedSrc } = mergeOnWhitelist([
      { source: 'ui-default', data: ui },
      { source: 'user', data: userOnly },
    ])
    uiParams.value = merged
    sourceInfo.value = mergedSrc
    dirty.value = markDirty
  }

  function applyUserEdit(path, value) {
    if (!uiParams.value)
      return
    setByPath(uiParams.value, path, value)
    setByPath(sourceInfo.value, path, 'user')
    dirty.value = true
  }

  function applyAdvancedOverrides(overrides) {
    if (!overrides)
      return
    if (typeof overrides.antialiasing === 'boolean')
      applyUserEdit('advanced.antialiasing', overrides.antialiasing)
    if (typeof overrides.antialiasingLevel === 'number' && AA_UI_LEVELS.includes(overrides.antialiasingLevel))
      applyUserEdit('advanced.antialiasingLevel', overrides.antialiasingLevel)
    if (typeof overrides.imageBlurEnable === 'boolean')
      applyUserEdit('advanced.imageBlurEnable', overrides.imageBlurEnable)
    const blurPixel = overrides.imageBlurPixel
    if (typeof blurPixel === 'number' && Number.isInteger(blurPixel) && blurPixel >= BLUR_UI_MIN && blurPixel <= BLUR_UI_MAX)
      applyUserEdit('advanced.imageBlurPixel', blurPixel)
  }

  function resetField(path, to = 'source') {
    if (!uiParams.value)
      return
    let targetVal
    if (to === 'default') {
      targetVal = getByPath(adapters.fromDefault(_rawDefaultJson.value || {}), path)
      setByPath(sourceInfo.value, path, 'default')
    }
    else if (to === 'resin') {
      targetVal = getByPath(adapters.fromResin(_rawResinJson.value || {}), path)
      setByPath(sourceInfo.value, path, 'resin')
    }
    else {
      const src = getByPath(sourceInfo.value, path)
      if (src === 'resin')
        targetVal = getByPath(adapters.fromResin(_rawResinJson.value || {}), path)
      else if (src === 'default')
        targetVal = getByPath(adapters.fromDefault(_rawDefaultJson.value || {}), path)
      else targetVal = getByPath(uiParams.value, path)
    }
    if (targetVal !== undefined)
      setByPath(uiParams.value, path, targetVal)
    // update dirty flag: simplistic (remains true once any edit happened)
  }

  function submitParams() {
    const parsed = validateUi(uiParams.value)
    if (!parsed.success)
      return { ok: false, errors: parsed.error.issues }
    const payload = adapters.toEngineDefault(parsed.data)
    return { ok: true, payload }
  }

  return {
    uiParams,
    sourceInfo,
    dirty,
    profile,
    schemaVersion,
    _rawDefaultJson,
    _rawResinJson,
    isValid,
    invalidReasons,
    bedSize,
    buildHeight,
    bedRatio,
    resolution,
    exportFileType,
    previewImgResolution,
    printerModel,
    dentalMode,
    loadParams,
    loadCustomMachine,
    applyResin,
    applyUserEdit,
    applyAdvancedOverrides,
    resetField,
    submitParams,
  }
})
