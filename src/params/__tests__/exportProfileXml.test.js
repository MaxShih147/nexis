import { describe, expect, it } from 'vitest'

import defaultJson from '../../data/default_profiles/sonic_ls_plus.json'
import { buildProfileExport } from '../exportProfileXml'
import { parseResinProfileXml } from '../importProfileXml'
import { resolveParams } from '../resolveParams'

function makeResinJsonWithMode(modeOverrides) {
  return {
    printer_name: 'Test',
    __selected_thickness: 0.05,
    __selected_mode: 'stable',
    profiles: [
      {
        resin_name: 'Test Resin',
        printer_brand: 'Test',
        printer_name: 'Test',
        export_type: 268,
        dimensions: { x: 100, y: 60, z: 200 },
        resolution: { x: 3840, y: 2160 },
        margin_buffer: { x: 0, y: 0 },
        image_mirror: 0,
        thickness_configs: [
          {
            thickness_mm: 0.05,
            thickness_display: '50 um',
            modes: [
              {
                mode: 'stable',
                thickness_mm: 0.05,
                ratio: { x: 1, y: 1, z: 1 },
                two_stage: 0,
                base_layers: 5,
                base_curing_time: 35,
                normal_curing_time: 2.5,
                base_lift_height: 6,
                base_peel_speed: 60,
                base_return_speed: 150,
                normal_lift_height: 6,
                normal_peel_speed: 60,
                normal_return_speed: 150,
                normal_wait_before_print: 0,
                normal_wait_after_print: 0,
                normal_wait_lift: 0,
                buffer_layer_number: 0,
                light_pwm: 255,
                bottom_light_pwm: 255,
                grayscale_level: 0,
                gcode: { start: '', mid: '', end: '' },
                compensate_size: { default: { in: 0, out: 0 }, customize: {} },
                ...modeOverrides,
              },
            ],
          },
        ],
      },
    ],
  }
}

describe('buildProfileExport', () => {
  it('exports an XML profile from default params without a resin profile', () => {
    const { ui } = resolveParams(defaultJson, null)

    const { fileName, xml } = buildProfileExport({
      uiParams: ui,
      resinJson: null,
      defaultJson,
      profile: { machineName: 'sonic_ls_plus', resinName: null },
    })

    expect(fileName).toBe('Sonic LS Plus_Default Profile_profile.xml')
    expect(xml).toContain('<ResinConfig>')
    expect(xml).toContain('<ResinName>Default Profile</ResinName>')
    expect(xml).toContain('<ExportType>16648</ExportType>')

    const parsed = parseResinProfileXml(xml)
    expect(parsed.resinJson.profiles).toHaveLength(1)
    expect(parsed.resinJson.profiles[0].resin_name).toBe('Default Profile')
    expect(parsed.resinJson.profiles[0].export_type).toBe(16648)
    expect(parsed.resinJson.profiles[0].thickness_configs[0].modes[0].mode).toBe('stable')
  })
})

describe('buildProfileExport — Retract Distance second-distance write', () => {
  function pickMode(xml) {
    const parsed = parseResinProfileXml(xml)
    return parsed.resinJson.profiles[0].thickness_configs[0].modes[0]
  }

  it('writes UI retractDistance to retract_second_dist even when retract_dist was originally non-zero', () => {
    const resinJson = makeResinJsonWithMode({ retract_dist: 5, retract_second_dist: 0 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.motion.normal.retractDistance = 9
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.retract_dist).toBe(0)
    expect(mode.retract_second_dist).toBe(9)
  })

  it('writes UI retractDistance to retract_second_dist when only retract_second_dist was originally non-zero', () => {
    const resinJson = makeResinJsonWithMode({ retract_dist: 0, retract_second_dist: 8 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.motion.normal.retractDistance = 9
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.retract_dist).toBe(0)
    expect(mode.retract_second_dist).toBe(9)
  })

  it('writes UI bottom retractDistance to bottom_retract_second_dist even when bottom_retract_dist was originally non-zero', () => {
    const resinJson = makeResinJsonWithMode({ bottom_retract_dist: 5, bottom_retract_second_dist: 0 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.motion.bottom.retractDistance = 9
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.bottom_retract_dist).toBe(0)
    expect(mode.bottom_retract_second_dist).toBe(9)
  })

  it('writes UI bottom retractDistance to bottom_retract_second_dist when only bottom_retract_second_dist was originally non-zero', () => {
    const resinJson = makeResinJsonWithMode({ bottom_retract_dist: 0, bottom_retract_second_dist: 8 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.motion.bottom.retractDistance = 9
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.bottom_retract_dist).toBe(0)
    expect(mode.bottom_retract_second_dist).toBe(9)
  })

  it('does NOT write the UI computed retractSecondDistance into resin (UI-only second column)', () => {
    const resinJson = makeResinJsonWithMode({ retract_dist: 5, retract_second_dist: 0 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.motion.normal.retractDistance = 5
    ui.motion.normal.retractSecondDistance = 999 // garbage UI value; must be ignored
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.retract_second_dist).toBe(5)
  })

  it('writes print.restBeforeLift into normal_wait_after_print', () => {
    const resinJson = makeResinJsonWithMode({ normal_wait_after_print: 0 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.print.restBeforeLift = 0.4
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.normal_wait_after_print).toBe(0.4)
  })

  it('writes print.restAfterLift into normal_wait_lift', () => {
    const resinJson = makeResinJsonWithMode({ normal_wait_lift: 0 })
    const { ui } = resolveParams(defaultJson, resinJson)
    ui.print.restAfterLift = 0.7
    const { xml } = buildProfileExport({ uiParams: ui, resinJson, defaultJson, profile: {} })
    const mode = pickMode(xml)
    expect(mode.normal_wait_lift).toBe(0.7)
  })
})

describe('buildProfileExport — AA/blur round-trip via DSOnlineSlicingParams', () => {
  it('exports AA=false, blur=false by default and parses back as advancedOverrides', () => {
    const { ui } = resolveParams(defaultJson, null)
    const { xml } = buildProfileExport({ uiParams: ui, resinJson: null, defaultJson, profile: {} })
    expect(xml).toContain('<DSOnlineSlicingParams>')
    const { advancedOverrides } = parseResinProfileXml(xml)
    expect(advancedOverrides).not.toBeNull()
    expect(advancedOverrides.antialiasing).toBe(false)
    expect(advancedOverrides.imageBlurEnable).toBe(false)
  })

  it('round-trips AA=true, level=8, blur=true, pixel=5', () => {
    const { ui } = resolveParams(defaultJson, null)
    ui.advanced.antialiasing = true
    ui.advanced.antialiasingLevel = 8
    ui.advanced.imageBlurEnable = true
    ui.advanced.imageBlurPixel = 5
    const { xml } = buildProfileExport({ uiParams: ui, resinJson: null, defaultJson, profile: {} })
    const { advancedOverrides } = parseResinProfileXml(xml)
    expect(advancedOverrides.antialiasing).toBe(true)
    expect(advancedOverrides.antialiasingLevel).toBe(8)
    expect(advancedOverrides.imageBlurEnable).toBe(true)
    expect(advancedOverrides.imageBlurPixel).toBe(5)
  })

  it('exports effective blur=false when AA=false even if imageBlurEnable=true (D2 logic)', () => {
    const { ui } = resolveParams(defaultJson, null)
    ui.advanced.antialiasing = false
    ui.advanced.imageBlurEnable = true
    const { xml } = buildProfileExport({ uiParams: ui, resinJson: null, defaultJson, profile: {} })
    const { advancedOverrides } = parseResinProfileXml(xml)
    expect(advancedOverrides.antialiasing).toBe(false)
    expect(advancedOverrides.imageBlurEnable).toBe(false)
  })

  it('returns advancedOverrides=null for XML with no DSOnlineSlicingParams section', () => {
    const { ui } = resolveParams(defaultJson, null)
    const { xml } = buildProfileExport({ uiParams: ui, resinJson: null, defaultJson, profile: {} })
    const xmlWithoutExtension = xml.replace(/<DSOnlineSlicingParams>[\s\S]*?<\/DSOnlineSlicingParams>/, '')
    const { advancedOverrides } = parseResinProfileXml(xmlWithoutExtension)
    expect(advancedOverrides).toBeNull()
  })
})
