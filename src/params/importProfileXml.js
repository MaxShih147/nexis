function cleanText(value) {
  if (value == null)
    return ''
  return String(value).trim()
}

function extractText(parent, selector) {
  if (!parent)
    return ''
  const el = parent.querySelector(selector)
  if (!el)
    return ''
  return cleanText(el.textContent)
}

function extractNumber(parent, selector) {
  const raw = extractText(parent, selector)
  if (!raw)
    return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : null
}

function extractCdata(parent, selector) {
  if (!parent)
    return ''
  const el = parent.querySelector(selector)
  if (!el)
    return ''
  const text = el.textContent ?? ''
  return text.replace(/\r/g, '').trim()
}

function parseCompensateSize(node) {
  if (!node)
    return { default: {}, customize: {} }
  const defaultNode = node.querySelector('Default')
  const customizeNode = node.querySelector('Customize')
  const extractSection = section => ({
    in: extractNumber(section, 'CompensateSizeIn'),
    in_base: extractNumber(section, 'CompensateSizeInBase'),
    out: extractNumber(section, 'CompensateSizeOut'),
    out_base: extractNumber(section, 'CompensateSizeOutBase'),
  })
  return {
    default: extractSection(defaultNode),
    customize: extractSection(customizeNode),
  }
}

function parseTimelapse(node) {
  if (!node)
    return {}
  return {
    enabled: extractNumber(node, 'timeLapseSwitchFile'),
    interval_layers: extractNumber(node, 'timeLapseIntervalLayersFile'),
    move_speed: extractNumber(node, 'timeLapseMoveSpeedFile'),
  }
}

function parseRatio(node) {
  if (!node)
    return {}
  const ratioNode = node.querySelector('Ratio')
  return {
    x: extractNumber(ratioNode, 'RatioX'),
    y: extractNumber(ratioNode, 'RatioY'),
    z: extractNumber(ratioNode, 'RatioZ'),
  }
}

function parseExposureData(node, configThickness) {
  if (!node)
    return null
  const ratio = parseRatio(node)
  const timelapse = parseTimelapse(node)
  const compensateSize = parseCompensateSize(node.querySelector('CompensateSize'))

  return {
    mode: extractText(node, 'ThicknessName') || 'stable',
    thickness_mm: extractNumber(node, 'Thickness') ?? configThickness ?? 0,
    ratio,
    two_stage: extractNumber(node, 'TwoStage'),
    bottom_retract_dist: extractNumber(node, 'bottomRetractDistInputFile'),
    bottom_lift_second_dist: extractNumber(node, 'bottomLiftSecondDistInputFile'),
    bottom_lift_second_speed: extractNumber(node, 'bottomLiftSecondSpeedInputFile'),
    bottom_retract_second_dist: extractNumber(node, 'bottomRetractSecondDistInputFile'),
    bottom_retract_second_speed: extractNumber(node, 'bottomRetractSecondSpeedInputFile'),
    bottom_light_pwm: extractNumber(node, 'bottomLigthPwmInputFile'),
    retract_dist: extractNumber(node, 'retractDistInputFile'),
    lift_second_dist: extractNumber(node, 'liftSecondDistInputFile'),
    lift_second_speed: extractNumber(node, 'liftSecondSpeedInputFile'),
    retract_second_dist: extractNumber(node, 'retractSecondDistInputFile'),
    retract_second_speed: extractNumber(node, 'retractSecondSpeedInputFile'),
    light_pwm: extractNumber(node, 'ligthPwmInputFile'),
    rotate_para: extractNumber(node, 'RotatePara'),
    grayscale_level: extractNumber(node, 'grayScaleLevelInputFile'),
    timelapse,
    exposure_delay_mode: extractNumber(node, 'exposureDelayModeFile'),
    turn_off_time: extractNumber(node, 'turnOffTimeInputFile'),
    advance_mode: extractNumber(node, 'advanceModeFile'),
    base_layers: extractNumber(node, 'NumBaseLayer'),
    base_curing_time: extractNumber(node, 'BaseCuringTime'),
    base_lift_height: extractNumber(node, 'BaseLiftHeight'),
    normal_curing_time: extractNumber(node, 'NormalCuringTime'),
    normal_wait_before_print: extractNumber(node, 'NormalWaitBeforePrint'),
    normal_wait_after_print: extractNumber(node, 'NormalWaitAfterPrint'),
    normal_wait_lift: extractNumber(node, 'NormalWaitLift'),
    normal_lift_height: extractNumber(node, 'NormalLiftHeight'),
    base_peel_speed: extractNumber(node, 'BasePeelSpeed'),
    base_return_speed: extractNumber(node, 'BaseReturnSpeed'),
    normal_peel_speed: extractNumber(node, 'NormalPeelSpeed'),
    normal_return_speed: extractNumber(node, 'NormalReturnSpeed'),
    buffer_layer_number: extractNumber(node, 'BufferLayerNumber'),
    gcode: {
      start: extractCdata(node, 'GCODEStart'),
      mid: extractCdata(node, 'GCODEMid'),
      end: extractCdata(node, 'GCODEEnd'),
    },
    compensate_size: compensateSize,
  }
}

function parseThicknessConfig(node) {
  if (!node)
    return null
  const thickness = extractNumber(node, 'Thickness') ?? 0
  const modes = Array.from(node.querySelectorAll('ExposureData'))
    .map(modeNode => parseExposureData(modeNode, thickness))
    .filter(Boolean)

  return {
    thickness_display: extractText(node, 'ThicknessName') || `${Math.round(thickness * 1000)} um`,
    thickness_mm: thickness,
    modes,
    compensate_mode: extractNumber(node, 'CompensateMode'),
  }
}

function parseResinConfig(node) {
  if (!node)
    return null
  const dimensions = {
    x: extractNumber(node, 'DimensionX'),
    y: extractNumber(node, 'DimensionY'),
    z: extractNumber(node, 'DimensionZ'),
  }
  const resolution = {
    x: extractNumber(node, 'ResolutionX'),
    y: extractNumber(node, 'ResolutionY'),
  }
  const margin_buffer = {
    x: extractNumber(node, 'MarginBufferX'),
    y: extractNumber(node, 'MarginBufferY'),
  }
  const defaultThicknessNode = node.querySelector('DefaultThickness')
  const defaultThickness = extractNumber(defaultThicknessNode, 'ThicknessValue')

  const color = {
    r: extractNumber(node, 'ResinColorR'),
    g: extractNumber(node, 'ResinColorG'),
    b: extractNumber(node, 'ResinColorB'),
  }

  const thickness_configs = Array.from(node.querySelectorAll('ThicknessConfig'))
    .map(parseThicknessConfig)
    .filter(Boolean)

  const profile = {
    brand_name: extractText(node, 'BrandName') || 'Imported',
    resin_name: extractText(node, 'ResinName') || 'Resin',
    printer_brand: extractText(node, 'PrinterBrand') || null,
    printer_name: extractText(node, 'PrinterName') || null,
    export_type: extractNumber(node, 'ExportType'),
    dimensions,
    resolution,
    margin_buffer,
    image_mirror: extractNumber(node, 'ImageMirror'),
    thickness_configs,
    default_thickness: defaultThickness,
    add_by_user: extractNumber(node, 'AddByUser'),
    resin_color: color,
  }

  const machine = {
    name: profile.printer_name || 'Custom Machine',
    brand: profile.printer_brand || '',
    dimensions,
    bedSize: { x: dimensions.x ?? null, y: dimensions.y ?? null },
    zHeight: dimensions.z ?? null,
    resolution,
    margin_buffer,
    mirror: profile.image_mirror,
    export_type: profile.export_type,
  }

  return { profile, machine }
}

export function parseResinProfileXml(xmlText) {
  if (typeof DOMParser === 'undefined')
    throw new Error('DOMParser is not available in the current environment')
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')
  const parseError = doc.querySelector('parsererror')
  if (parseError)
    throw new Error('Failed to parse XML profile')

  const configVersion = extractText(doc, 'PrintingInformation > ConfigVersion')
  const resinConfigNodes = Array.from(doc.querySelectorAll('PrintingParameters > PrinterConfig > ResinConfig'))
  if (!resinConfigNodes.length)
    throw new Error('Missing ResinConfig in profile')

  const profiles = []
  let machine = null
  for (const node of resinConfigNodes) {
    const parsed = parseResinConfig(node)
    if (!parsed)
      continue
    profiles.push(parsed.profile)
    machine = machine || parsed.machine
  }

  const resinJson = {
    printer_name: machine?.name || '',
    profiles,
  }

  if (profiles[0]?.default_thickness)
    resinJson.__selected_thickness = profiles[0].default_thickness
  const firstMode = profiles[0]?.thickness_configs?.[0]?.modes?.[0]?.mode
  if (firstMode)
    resinJson.__selected_mode = firstMode

  // Parse DS-Online slicing extensions (AA/blur user settings)
  let advancedOverrides = null
  const dsParams = doc.querySelector('PrintingInformation > DSOnlineSlicingParams')
  if (dsParams) {
    advancedOverrides = {}
    const aaText = extractText(dsParams, 'AntiAliasing')
    if (aaText !== '')
      advancedOverrides.antialiasing = aaText === 'true'
    const aaLevelText = extractText(dsParams, 'AntiAliasingLevel')
    if (aaLevelText !== '') {
      const n = Number(aaLevelText)
      if (Number.isFinite(n))
        advancedOverrides.antialiasingLevel = n
    }
    const blurText = extractText(dsParams, 'ImageBlur')
    if (blurText !== '')
      advancedOverrides.imageBlurEnable = blurText === 'true'
    const blurPixelText = extractText(dsParams, 'ImageBlurPixel')
    if (blurPixelText !== '') {
      const n = Number(blurPixelText)
      if (Number.isFinite(n))
        advancedOverrides.imageBlurPixel = n
    }
  }

  return {
    configVersion: configVersion ? Number(configVersion) || null : null,
    resinJson,
    machine,
    advancedOverrides,
  }
}

export async function loadResinProfileFromFile(file) {
  const text = await file.text()
  return parseResinProfileXml(text)
}
