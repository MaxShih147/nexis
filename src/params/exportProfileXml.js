const EPSILON = 1e-6
const DEFAULT_CONFIG_VERSION = '1.2.19'
const DEFAULT_SOFTWARE_INFO = {
  software: 'DS Online',
  version: '1.0.0',
  subVersion: 'DEMO',
  factoryDefault: 1,
  forceUpdate: 0,
}

function indent(level) {
  return '  '.repeat(level)
}

function approxEqual(a, b) {
  const left = Number(a)
  const right = Number(b)
  if (!Number.isFinite(left) || !Number.isFinite(right))
    return false
  return Math.abs(left - right) < EPSILON
}

function toNumber(value, fallback = null) {
  if (value === undefined || value === null || value === '')
    return fallback
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function formatFloat(value, decimals = 6) {
  return toNumber(value, 0).toFixed(decimals)
}

function formatInt(value) {
  return String(Math.round(toNumber(value, 0)))
}

function mmPerSecToMmPerMin(value) {
  const num = toNumber(value, null)
  if (num === null)
    return null
  return num * 60
}

function sanitizeFilenameSegment(name) {
  return String(name ?? '')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function assignNumber(target, key, value, transform) {
  if (!target)
    return
  if (value === undefined || value === null)
    return
  const transformed = transform ? transform(value) : value
  const numeric = toNumber(transformed, target[key])
  if (numeric === null || numeric === undefined)
    return
  target[key] = numeric
}

function assignString(target, key, value) {
  if (!target)
    return
  if (value === undefined || value === null)
    return
  const str = String(value)
  if (!str.length)
    return
  target[key] = str
}

function defaultExportTypeFromFileType(fileType) {
  return String(fileType || '').toLowerCase() === 'zip' ? 268 : 16648
}

function normalizeMachineLabel(name) {
  return String(name || '').replace(/_/g, ' ').trim()
}

function createFallbackResinProfile({ uiParams, defaultJson, profile }) {
  const machine = uiParams?.machine || {}
  const print = uiParams?.print || {}
  const motion = uiParams?.motion || {}
  const advanced = uiParams?.advanced || {}
  const gcode = uiParams?.gcode || {}
  const machineName = normalizeMachineLabel(machine.name)
    || normalizeMachineLabel(defaultJson?.Machine?.['Machine Name'])
    || normalizeMachineLabel(profile?.machineName)
    || 'Machine'
  const resinName = uiParams?.resin?.name || profile?.resinName || 'Default Profile'
  const layerHeight = toNumber(print.layerHeight, 0.05) ?? 0.05
  const normalMotion = motion.normal || {}
  const bottomMotion = motion.bottom || {}
  const exportType = defaultExportTypeFromFileType(defaultJson?.Other?.export_file_type)

  return {
    brand_name: machine.type || 'Imported',
    resin_name: resinName,
    printer_brand: machine.type || '',
    printer_name: machineName,
    export_type: exportType,
    dimensions: {
      x: toNumber(machine.bedSize?.x, 0),
      y: toNumber(machine.bedSize?.y, 0),
      z: toNumber(machine.zHeight, 0),
    },
    resolution: {
      x: toNumber(machine.resolution?.x, 0),
      y: toNumber(machine.resolution?.y, 0),
    },
    margin_buffer: {
      x: toNumber(machine.margin, 0),
      y: toNumber(machine.margin, 0),
    },
    image_mirror: typeof machine.mirror === 'boolean' ? (machine.mirror ? 1 : 0) : toNumber(machine.mirror, 0),
    default_thickness: layerHeight,
    add_by_user: 1,
    resin_color: { r: 255, g: 255, b: 255 },
    thickness_configs: [
      {
        thickness_display: `${Math.round(layerHeight * 1000)} um`,
        thickness_mm: layerHeight,
        compensate_mode: 0,
        modes: [
          {
            mode: 'stable',
            thickness_mm: layerHeight,
            ratio: { x: 1, y: 1, z: 1 },
            two_stage: 0,
            bottom_retract_dist: 0,
            bottom_lift_second_dist: toNumber(bottomMotion.liftSecondDistance, 0),
            bottom_lift_second_speed: toNumber(bottomMotion.liftSecondSpeed, 0),
            bottom_retract_second_dist: toNumber(bottomMotion.retractDistance, 0),
            bottom_retract_second_speed: toNumber(bottomMotion.retractSecondSpeed, 0),
            bottom_light_pwm: toNumber(advanced.bottomLightPWM, 255),
            retract_dist: 0,
            lift_second_dist: toNumber(normalMotion.liftSecondDistance, 0),
            lift_second_speed: toNumber(normalMotion.liftSecondSpeed, 0),
            retract_second_dist: toNumber(normalMotion.retractDistance, 0),
            retract_second_speed: toNumber(normalMotion.retractSecondSpeed, 0),
            light_pwm: toNumber(advanced.lightPWM, 255),
            rotate_para: 0,
            grayscale_level: toNumber(advanced.greyLevel, 0),
            timelapse: {
              enabled: 0,
              interval_layers: 1,
              move_speed: 0,
            },
            exposure_delay_mode: 0,
            turn_off_time: 0,
            advance_mode: 0,
            base_layers: toNumber(print.bottom?.layers, 0),
            base_curing_time: toNumber(print.bottom?.exposure, 0),
            base_lift_height: toNumber(bottomMotion.liftHeight, 0),
            normal_curing_time: toNumber(print.exposure, 0),
            normal_wait_before_print: toNumber(print.lightOffDelay, 0),
            normal_wait_after_print: toNumber(print.restBeforeLift, 0),
            normal_wait_lift: toNumber(print.restAfterLift, 0),
            normal_lift_height: toNumber(normalMotion.liftHeight, 0),
            base_peel_speed: toNumber(bottomMotion.liftSpeed, 0),
            base_return_speed: toNumber(bottomMotion.retractSpeed, 0),
            normal_peel_speed: toNumber(normalMotion.liftSpeed, 0),
            normal_return_speed: toNumber(normalMotion.retractSpeed, 0),
            buffer_layer_number: toNumber(print.transition?.count, 0),
            gcode: {
              start: gcode.start || '',
              mid: gcode.mid || '',
              end: gcode.end || '',
            },
            compensate_size: {
              default: {
                in: toNumber(advanced.innerCompensate, 0),
                in_base: 0,
                out: toNumber(advanced.outerCompensate, 0),
                out_base: 0,
              },
              customize: {
                in: 0,
                in_base: 0,
                out: 0,
                out_base: 0,
              },
            },
          },
        ],
      },
    ],
  }
}

function buildThicknessConfigXml(cfg, level = 4) {
  const lines = []
  lines.push(`${indent(level)}<ThicknessConfig>`)
  lines.push(`${indent(level + 1)}<ThicknessName>${cfg.thickness_display ?? ''}</ThicknessName>`)
  lines.push(`${indent(level + 1)}<Thickness>${formatFloat(cfg.thickness_mm)}</Thickness>`)
  for (const mode of cfg.modes || []) {
    lines.push(buildExposureDataXml(mode, cfg, level + 1))
  }
  const compensateMode = cfg.compensate_mode ?? 0
  lines.push(`${indent(level + 1)}<CompensateMode>${formatInt(compensateMode)}</CompensateMode>`)
  lines.push(`${indent(level)}</ThicknessConfig>`)
  return lines.join('\n')
}

function buildExposureDataXml(mode, cfg, level = 5) {
  const ratio = mode.ratio || {}
  const timelapse = mode.timelapse || {}
  const compSize = mode.compensate_size || {}
  const compDefault = compSize.default || {}
  const compCustomize = compSize.customize || {}
  const start = mode.gcode?.start ?? ''
  const mid = mode.gcode?.mid ?? ''
  const end = mode.gcode?.end ?? ''
  const lines = []
  lines.push(`${indent(level)}<ExposureData>`)
  lines.push(`${indent(level + 1)}<ThicknessName>${mode.mode ?? ''}</ThicknessName>`)
  lines.push(`${indent(level + 1)}<Thickness>${formatFloat(mode.thickness_mm ?? cfg.thickness_mm)}</Thickness>`)
  lines.push(`${indent(level + 1)}<Ratio>`)
  lines.push(`${indent(level + 2)}<RatioX>${formatFloat(ratio.x ?? 1)}</RatioX>`)
  lines.push(`${indent(level + 2)}<RatioY>${formatFloat(ratio.y ?? 1)}</RatioY>`)
  lines.push(`${indent(level + 2)}<RatioZ>${formatFloat(ratio.z ?? 1)}</RatioZ>`)
  lines.push(`${indent(level + 1)}</Ratio>`)
  lines.push(`${indent(level + 1)}<TwoStage>${formatInt(mode.two_stage ?? 0)}</TwoStage>`)
  lines.push(`${indent(level + 1)}<bottomRetractDistInputFile>${formatFloat(mode.bottom_retract_dist)}</bottomRetractDistInputFile>`)
  lines.push(`${indent(level + 1)}<bottomLiftSecondDistInputFile>${formatFloat(mode.bottom_lift_second_dist)}</bottomLiftSecondDistInputFile>`)
  lines.push(`${indent(level + 1)}<bottomLiftSecondSpeedInputFile>${formatFloat(mode.bottom_lift_second_speed)}</bottomLiftSecondSpeedInputFile>`)
  lines.push(`${indent(level + 1)}<bottomRetractSecondDistInputFile>${formatFloat(mode.bottom_retract_second_dist)}</bottomRetractSecondDistInputFile>`)
  lines.push(`${indent(level + 1)}<bottomRetractSecondSpeedInputFile>${formatFloat(mode.bottom_retract_second_speed)}</bottomRetractSecondSpeedInputFile>`)
  lines.push(`${indent(level + 1)}<bottomLigthPwmInputFile>${formatInt(mode.bottom_light_pwm)}</bottomLigthPwmInputFile>`)
  lines.push(`${indent(level + 1)}<retractDistInputFile>${formatFloat(mode.retract_dist)}</retractDistInputFile>`)
  lines.push(`${indent(level + 1)}<liftSecondDistInputFile>${formatFloat(mode.lift_second_dist)}</liftSecondDistInputFile>`)
  lines.push(`${indent(level + 1)}<liftSecondSpeedInputFile>${formatFloat(mode.lift_second_speed)}</liftSecondSpeedInputFile>`)
  lines.push(`${indent(level + 1)}<retractSecondDistInputFile>${formatFloat(mode.retract_second_dist)}</retractSecondDistInputFile>`)
  lines.push(`${indent(level + 1)}<retractSecondSpeedInputFile>${formatFloat(mode.retract_second_speed)}</retractSecondSpeedInputFile>`)
  lines.push(`${indent(level + 1)}<ligthPwmInputFile>${formatInt(mode.light_pwm)}</ligthPwmInputFile>`)
  lines.push(`${indent(level + 1)}<RotatePara>${formatInt(mode.rotate_para ?? 0)}</RotatePara>`)
  lines.push(`${indent(level + 1)}<grayScaleLevelInputFile>${formatInt(mode.grayscale_level)}</grayScaleLevelInputFile>`)
  lines.push(`${indent(level + 1)}<timeLapseSwitchFile>${formatInt(timelapse.enabled ?? 0)}</timeLapseSwitchFile>`)
  lines.push(`${indent(level + 1)}<timeLapseIntervalLayersFile>${formatInt(timelapse.interval_layers ?? 1)}</timeLapseIntervalLayersFile>`)
  lines.push(`${indent(level + 1)}<timeLapseMoveSpeedFile>${formatFloat(timelapse.move_speed ?? 0)}</timeLapseMoveSpeedFile>`)
  lines.push(`${indent(level + 1)}<exposureDelayModeFile>${formatInt(mode.exposure_delay_mode ?? 0)}</exposureDelayModeFile>`)
  lines.push(`${indent(level + 1)}<turnOffTimeInputFile>${formatFloat(mode.turn_off_time ?? 0)}</turnOffTimeInputFile>`)
  lines.push(`${indent(level + 1)}<advanceModeFile>${formatInt(mode.advance_mode ?? 0)}</advanceModeFile>`)
  lines.push(`${indent(level + 1)}<NumBaseLayer>${formatInt(mode.base_layers)}</NumBaseLayer>`)
  lines.push(`${indent(level + 1)}<BaseCuringTime>${formatFloat(mode.base_curing_time)}</BaseCuringTime>`)
  lines.push(`${indent(level + 1)}<BaseLiftHeight>${formatFloat(mode.base_lift_height)}</BaseLiftHeight>`)
  lines.push(`${indent(level + 1)}<NormalCuringTime>${formatFloat(mode.normal_curing_time)}</NormalCuringTime>`)
  lines.push(`${indent(level + 1)}<NormalWaitBeforePrint>${formatFloat(mode.normal_wait_before_print)}</NormalWaitBeforePrint>`)
  lines.push(`${indent(level + 1)}<NormalWaitAfterPrint>${formatFloat(mode.normal_wait_after_print)}</NormalWaitAfterPrint>`)
  lines.push(`${indent(level + 1)}<NormalWaitLift>${formatFloat(mode.normal_wait_lift)}</NormalWaitLift>`)
  lines.push(`${indent(level + 1)}<NormalLiftHeight>${formatFloat(mode.normal_lift_height)}</NormalLiftHeight>`)
  lines.push(`${indent(level + 1)}<BasePeelSpeed>${formatFloat(mode.base_peel_speed)}</BasePeelSpeed>`)
  lines.push(`${indent(level + 1)}<BaseReturnSpeed>${formatFloat(mode.base_return_speed)}</BaseReturnSpeed>`)
  lines.push(`${indent(level + 1)}<NormalPeelSpeed>${formatFloat(mode.normal_peel_speed)}</NormalPeelSpeed>`)
  lines.push(`${indent(level + 1)}<NormalReturnSpeed>${formatFloat(mode.normal_return_speed)}</NormalReturnSpeed>`)
  lines.push(buildCdataTag('GCODEStart', start, level + 1))
  lines.push(buildCdataTag('GCODEMid', mid, level + 1))
  lines.push(buildCdataTag('GCODEEnd', end, level + 1))
  lines.push(`${indent(level + 1)}<BufferLayerNumber>${formatInt(mode.buffer_layer_number)}</BufferLayerNumber>`)
  lines.push(`${indent(level + 1)}<CompensateSize>`)
  lines.push(`${indent(level + 2)}<Default>`)
  lines.push(`${indent(level + 3)}<CompensateSizeIn>${formatFloat(compDefault.in)}</CompensateSizeIn>`)
  lines.push(`${indent(level + 3)}<CompensateSizeInBase>${formatFloat(compDefault.in_base)}</CompensateSizeInBase>`)
  lines.push(`${indent(level + 3)}<CompensateSizeOut>${formatFloat(compDefault.out)}</CompensateSizeOut>`)
  lines.push(`${indent(level + 3)}<CompensateSizeOutBase>${formatFloat(compDefault.out_base)}</CompensateSizeOutBase>`)
  lines.push(`${indent(level + 2)}</Default>`)
  lines.push(`${indent(level + 2)}<Customize>`)
  lines.push(`${indent(level + 3)}<CompensateSizeIn>${formatFloat(compCustomize.in)}</CompensateSizeIn>`)
  lines.push(`${indent(level + 3)}<CompensateSizeInBase>${formatFloat(compCustomize.in_base)}</CompensateSizeInBase>`)
  lines.push(`${indent(level + 3)}<CompensateSizeOut>${formatFloat(compCustomize.out)}</CompensateSizeOut>`)
  lines.push(`${indent(level + 3)}<CompensateSizeOutBase>${formatFloat(compCustomize.out_base)}</CompensateSizeOutBase>`)
  lines.push(`${indent(level + 2)}</Customize>`)
  lines.push(`${indent(level + 1)}</CompensateSize>`)
  lines.push(`${indent(level)}</ExposureData>`)
  return lines.join('\n')
}

function buildCdataTag(tag, value, level) {
  const content = String(value ?? '')
  const inner = content.length
    ? content.split('\n').map(line => `${indent(level + 2)}${line}`).join('\n')
    : ''
  const lines = []
  lines.push(`${indent(level)}<${tag}>`)
  lines.push(`${indent(level + 1)}<![CDATA[`)
  if (inner.length)
    lines.push(inner)
  lines.push(`${indent(level + 1)}]]>`)
  lines.push(`${indent(level)}</${tag}>`)
  return lines.join('\n')
}

function buildResinConfigXml(profile) {
  const lines = []
  lines.push(`${indent(3)}<ResinConfig>`)
  lines.push(`${indent(4)}<BrandName>${profile.brand_name ?? ''}</BrandName>`)
  lines.push(`${indent(4)}<ResinName>${profile.resin_name ?? ''}</ResinName>`)
  lines.push(`${indent(4)}<PrinterBrand>${profile.printer_brand ?? ''}</PrinterBrand>`)
  lines.push(`${indent(4)}<PrinterName>${profile.printer_name ?? ''}</PrinterName>`)
  lines.push(`${indent(4)}<ExportType>${formatInt(profile.export_type)}</ExportType>`)
  const dimensions = profile.dimensions || {}
  lines.push(`${indent(4)}<DimensionX>${formatFloat(dimensions.x)}</DimensionX>`)
  lines.push(`${indent(4)}<DimensionY>${formatFloat(dimensions.y)}</DimensionY>`)
  lines.push(`${indent(4)}<DimensionZ>${formatFloat(dimensions.z)}</DimensionZ>`)
  lines.push(`${indent(4)}<ImageMirror>${formatInt(profile.image_mirror)}</ImageMirror>`)
  const resolution = profile.resolution || {}
  lines.push(`${indent(4)}<ResolutionX>${formatInt(resolution.x)}</ResolutionX>`)
  lines.push(`${indent(4)}<ResolutionY>${formatInt(resolution.y)}</ResolutionY>`)
  const margin = profile.margin_buffer || {}
  lines.push(`${indent(4)}<MarginBufferX>${formatFloat(margin.x)}</MarginBufferX>`)
  lines.push(`${indent(4)}<MarginBufferY>${formatFloat(margin.y)}</MarginBufferY>`)
  for (const cfg of profile.thickness_configs || []) {
    lines.push(buildThicknessConfigXml(cfg))
  }
  const defaultThickness = profile.default_thickness ?? profile.thickness_configs?.[0]?.thickness_mm ?? 0
  lines.push(`${indent(4)}<DefaultThickness>`)
  lines.push(`${indent(5)}<ThicknessValue>${formatFloat(defaultThickness)}</ThicknessValue>`)
  lines.push(`${indent(4)}</DefaultThickness>`)
  lines.push(`${indent(4)}<AddByUser>${formatInt(profile.add_by_user ?? 0)}</AddByUser>`)
  const color = profile.resin_color || {}
  lines.push(`${indent(4)}<ResinColorR>${formatInt(color.r ?? 255)}</ResinColorR>`)
  lines.push(`${indent(4)}<ResinColorG>${formatInt(color.g ?? 255)}</ResinColorG>`)
  lines.push(`${indent(4)}<ResinColorB>${formatInt(color.b ?? 255)}</ResinColorB>`)
  lines.push(`${indent(3)}</ResinConfig>`)
  return lines.join('\n')
}

function determineSelectedConfig(profile, selectedThickness, selectedMode) {
  const configs = profile.thickness_configs || []
  let cfgIndex = configs.findIndex(cfg => approxEqual(cfg.thickness_mm, selectedThickness))
  if (cfgIndex === -1)
    cfgIndex = 0
  const cfg = configs[cfgIndex] || { modes: [] }
  let modeIndex = (cfg.modes || []).findIndex(mode => mode.mode === selectedMode)
  if (modeIndex === -1)
    modeIndex = 0
  return { cfgIndex, modeIndex }
}

export function buildProfileExport({ uiParams, resinJson, defaultJson, profile, advancedOverrides }) {
  if (!uiParams)
    throw new Error('Parameters are not loaded')
  const resinProfile = resinJson?.profiles?.[0] || createFallbackResinProfile({ uiParams, defaultJson, profile })
  if (!resinProfile)
    throw new Error('Resin profile is not available')

  const profileClone = JSON.parse(JSON.stringify(resinProfile))
  const selectedThickness = resinJson?.__selected_thickness ?? uiParams.print?.layerHeight ?? profileClone.thickness_configs?.[0]?.thickness_mm ?? 0.05
  const selectedMode = resinJson?.__selected_mode ?? profileClone.thickness_configs?.[0]?.modes?.[0]?.mode ?? 'stable'
  const { cfgIndex, modeIndex } = determineSelectedConfig(profileClone, selectedThickness, selectedMode)
  const targetCfg = profileClone.thickness_configs?.[cfgIndex]
  if (!targetCfg)
    throw new Error('Failed to locate target thickness configuration')
  const targetMode = targetCfg.modes?.[modeIndex]
  if (!targetMode)
    throw new Error('Failed to locate target exposure mode')

  const layerHeight = toNumber(uiParams.print?.layerHeight, targetCfg.thickness_mm)
  if (layerHeight !== null && layerHeight !== undefined) {
    targetCfg.thickness_mm = layerHeight
    targetCfg.thickness_display = `${Math.round(layerHeight * 1000)} um`
    targetMode.thickness_mm = layerHeight
    assignNumber(profileClone, 'default_thickness', layerHeight)
  }

  assignNumber(targetMode, 'base_layers', uiParams.print?.bottom?.layers)
  assignNumber(targetMode, 'base_curing_time', uiParams.print?.bottom?.exposure)
  assignNumber(targetMode, 'base_lift_height', uiParams.motion?.bottom?.liftHeight)
  assignNumber(targetMode, 'base_peel_speed', uiParams.motion?.bottom?.liftSpeed)
  assignNumber(targetMode, 'base_return_speed', uiParams.motion?.bottom?.retractSpeed)
  assignNumber(targetMode, 'bottom_retract_dist', 0)
  assignNumber(targetMode, 'bottom_retract_second_dist', uiParams.motion?.bottom?.retractDistance)
  assignNumber(targetMode, 'bottom_lift_second_dist', uiParams.motion?.bottom?.liftSecondDistance)
  assignNumber(targetMode, 'bottom_lift_second_speed', uiParams.motion?.bottom?.liftSecondSpeed)
  assignNumber(targetMode, 'bottom_retract_second_speed', uiParams.motion?.bottom?.retractSecondSpeed)

  assignNumber(targetMode, 'normal_curing_time', uiParams.print?.exposure)
  assignNumber(targetMode, 'normal_wait_before_print', uiParams.print?.lightOffDelay)
  assignNumber(targetMode, 'normal_wait_after_print', uiParams.print?.restBeforeLift)
  assignNumber(targetMode, 'normal_wait_lift', uiParams.print?.restAfterLift)
  assignNumber(targetMode, 'normal_lift_height', uiParams.motion?.normal?.liftHeight)
  assignNumber(targetMode, 'normal_peel_speed', uiParams.motion?.normal?.liftSpeed)
  assignNumber(targetMode, 'normal_return_speed', uiParams.motion?.normal?.retractSpeed)
  assignNumber(targetMode, 'retract_dist', 0)
  assignNumber(targetMode, 'retract_second_dist', uiParams.motion?.normal?.retractDistance)
  assignNumber(targetMode, 'lift_second_dist', uiParams.motion?.normal?.liftSecondDistance)
  assignNumber(targetMode, 'lift_second_speed', uiParams.motion?.normal?.liftSecondSpeed)
  assignNumber(targetMode, 'retract_second_speed', uiParams.motion?.normal?.retractSecondSpeed)

  assignNumber(targetMode, 'buffer_layer_number', uiParams.print?.transition?.count)
  assignNumber(targetMode, 'light_pwm', uiParams.advanced?.lightPWM)
  assignNumber(targetMode, 'bottom_light_pwm', uiParams.advanced?.bottomLightPWM)
  assignNumber(targetMode, 'grayscale_level', uiParams.advanced?.greyLevel)

  targetMode.compensate_size = targetMode.compensate_size || {}
  targetMode.compensate_size.default = targetMode.compensate_size.default || {}
  targetMode.compensate_size.customize = targetMode.compensate_size.customize || {}
  assignNumber(targetMode.compensate_size.default, 'in', uiParams.advanced?.innerCompensate)
  assignNumber(targetMode.compensate_size.default, 'out', uiParams.advanced?.outerCompensate)

  targetMode.gcode = targetMode.gcode || {}
  assignString(targetMode.gcode, 'start', uiParams.gcode?.start)
  assignString(targetMode.gcode, 'mid', uiParams.gcode?.mid)
  assignString(targetMode.gcode, 'end', uiParams.gcode?.end)

  const machine = uiParams.machine || {}
  profileClone.resolution = profileClone.resolution || {}
  profileClone.dimensions = profileClone.dimensions || {}
  profileClone.margin_buffer = profileClone.margin_buffer || {}
  assignNumber(profileClone.resolution, 'x', machine.resolution?.x)
  assignNumber(profileClone.resolution, 'y', machine.resolution?.y)
  assignNumber(profileClone.dimensions, 'x', machine.bedSize?.x)
  assignNumber(profileClone.dimensions, 'y', machine.bedSize?.y)
  assignNumber(profileClone.dimensions, 'z', machine.zHeight)
  assignNumber(profileClone, 'image_mirror', typeof machine.mirror === 'boolean' ? (machine.mirror ? 1 : 0) : machine.mirror)

  const resinName = uiParams.resin?.name ?? profileClone.resin_name ?? ''
  assignString(profileClone, 'resin_name', resinName)

  const defaultMachineName = defaultJson?.Machine?.['Machine Name']
  const machineNameCandidates = [
    profileClone.printer_name,
    machine.name,
    defaultMachineName ? defaultMachineName.replace(/_/g, ' ') : null,
    profile?.machineName,
  ]
  const machineName = machineNameCandidates.find(name => name && String(name).trim()) || 'machine'
  const fileName = `${sanitizeFilenameSegment(machineName)}_${sanitizeFilenameSegment(resinName || 'resin')}_profile.xml`

  const lines = []
  lines.push('<?xml version="1.0" encoding="UTF-8"?>')
  lines.push('<PrintingInformation>')
  lines.push(`${indent(1)}<ConfigVersion>${profileClone.config_version || DEFAULT_CONFIG_VERSION}</ConfigVersion>`)
  lines.push(`${indent(1)}<SoftwareInfo>`)
  lines.push(`${indent(2)}<VersionInfo>`)
  lines.push(`${indent(3)}<Software>${DEFAULT_SOFTWARE_INFO.software}</Software>`)
  lines.push(`${indent(3)}<Version>${DEFAULT_SOFTWARE_INFO.version}</Version>`)
  lines.push(`${indent(3)}<SubVersion>${DEFAULT_SOFTWARE_INFO.subVersion}</SubVersion>`)
  lines.push(`${indent(2)}</VersionInfo>`)
  lines.push(`${indent(2)}<FactoryDefault>${DEFAULT_SOFTWARE_INFO.factoryDefault}</FactoryDefault>`)
  lines.push(`${indent(2)}<ForceUpdate>${DEFAULT_SOFTWARE_INFO.forceUpdate}</ForceUpdate>`)
  lines.push(`${indent(2)}<BrandSorting/>`)
  lines.push(`${indent(1)}</SoftwareInfo>`)
  lines.push(`${indent(1)}<DeleteList/>`)
  lines.push(`${indent(1)}<PrintingParameters>`)
  lines.push(`${indent(2)}<PrinterConfig>`)
  lines.push(buildResinConfigXml(profileClone))
  lines.push(`${indent(2)}</PrinterConfig>`)
  lines.push(`${indent(1)}</PrintingParameters>`)

  // DS-Online slicing extensions: AA/blur user settings not present in standard format
  const advanced = uiParams?.advanced || {}
  const overrides = advancedOverrides || {}
  const aaEnable = 'antialiasing' in overrides ? overrides.antialiasing : !!advanced.antialiasing
  const aaLevel = 'antialiasingLevel' in overrides ? overrides.antialiasingLevel : (advanced.antialiasingLevel ?? 4)
  // effective blur: AA must be on for blur to be active (mirrors D2 / uiToDefault logic)
  const blurEnable = 'imageBlurEnable' in overrides
    ? !!(aaEnable && overrides.imageBlurEnable)
    : !!(advanced.antialiasing && advanced.imageBlurEnable)
  const blurPixel = 'imageBlurPixel' in overrides ? overrides.imageBlurPixel : (advanced.imageBlurPixel ?? 2)
  lines.push(`${indent(1)}<DSOnlineSlicingParams>`)
  lines.push(`${indent(2)}<AntiAliasing>${aaEnable}</AntiAliasing>`)
  lines.push(`${indent(2)}<AntiAliasingLevel>${aaLevel}</AntiAliasingLevel>`)
  lines.push(`${indent(2)}<ImageBlur>${blurEnable}</ImageBlur>`)
  lines.push(`${indent(2)}<ImageBlurPixel>${blurPixel}</ImageBlurPixel>`)
  lines.push(`${indent(1)}</DSOnlineSlicingParams>`)

  lines.push('</PrintingInformation>')

  return {
    fileName,
    xml: lines.join('\n'),
  }
}
