import { describe, expect, it } from 'vitest'
import defaultJson from '../../../data/default_profiles/sonic_4k_2022.json'
import resinJson from '../../../data/resin_profiles/sonic_4k_2022.json'
import { fromDefault, fromResin, seededUiDefaults, toEngineDefault } from '../../../params/adapters'
import { defaultToUi, pickResinMode, resinToUi, uiToDefault } from '../../../params/mappingTables'
import { resolveParams } from '../../../params/resolveParams'

function buildResinJson({ overrides = {}, modeOverrides = {} } = {}) {
  const baseMode = {
    mode: 'stable',
    thickness_mm: 0.05,
    base_layers: 5,
    base_curing_time: 35,
    normal_curing_time: 2.5,
    base_lift_height: 6,
    base_peel_speed: 60,
    base_return_speed: 150,
    normal_lift_height: 6,
    normal_peel_speed: 60,
    normal_return_speed: 150,
    normal_wait_before_print: 2,
    normal_wait_after_print: 0.4,
    normal_wait_lift: 0.5,
    buffer_layer_number: 6,
    retract_dist: 5,
    retract_second_dist: 8,
    bottom_retract_dist: 5,
    bottom_retract_second_dist: 8,
    lift_second_dist: 0,
    lift_second_speed: 0,
    bottom_lift_second_dist: 0,
    bottom_lift_second_speed: 0,
    retract_second_speed: 0,
    bottom_retract_second_speed: 0,
    light_pwm: 255,
    bottom_light_pwm: 255,
    grayscale_level: 0,
    turn_off_time: 9,
    gcode: { start: '', mid: '', end: '' },
    compensate_size: { default: { in: 0, out: 0 } },
    ...modeOverrides,
  }
  return {
    printer_name: 'Test',
    profiles: [
      {
        resin_name: 'Test Resin',
        thickness_configs: [
          {
            thickness_mm: 0.05,
            modes: [baseMode],
          },
        ],
      },
    ],
    ...overrides,
  }
}

describe('mapping tables', () => {
  it('have basic coverage', () => {
    expect(defaultToUi.length).toBeGreaterThan(5)
    expect(resinToUi.length).toBeGreaterThan(5)
    expect(uiToDefault.length).toBeGreaterThan(5)
  })
})

describe('adapters and merge', () => {
  it('fromDefault maps core fields', () => {
    const ui = fromDefault(defaultJson)
    expect(ui.print.layerHeight).toBeCloseTo(0.05, 5)
    expect(ui.print.bottom.layers).toBe(5)
    expect(ui.motion.bottom.liftSpeed).toBeCloseTo(60, 5)
  })

  it('fromResin selects 0.05mm stable mode', () => {
    const ui = fromResin(resinJson)
    expect(ui.print.layerHeight).toBeCloseTo(0.05, 5)
    expect(ui.print.bottom.layers).toBeGreaterThan(0)
  })

  it('resolveParams merges with priority', () => {
    const { ui } = resolveParams(defaultJson, resinJson)
    expect(ui.schemaVersion).toBe(1)
    expect(ui.print.layerHeight).toBeCloseTo(0.05, 5)
  })

  it('toEngineDefault reverses units', () => {
    const ui = { ...seededUiDefaults, motion: { ...seededUiDefaults.motion, normal: { ...seededUiDefaults.motion.normal, liftSpeed: 60 } } }
    const payload = toEngineDefault(ui)
    expect(payload.Print['Lifting Speed']).toBe(60)
  })
})

describe('fromDefault — machine profile key alignment', () => {
  it('reads Gcode from actual JSON keys (Start / Interlayer / End)', () => {
    const ui = fromDefault({
      Gcode: {
        Start: 'START_GCODE_TEXT',
        Interlayer: 'INTER_GCODE_TEXT',
        End: 'END_GCODE_TEXT',
      },
    })
    expect(ui.gcode.start).toBe('START_GCODE_TEXT')
    expect(ui.gcode.mid).toBe('INTER_GCODE_TEXT')
    expect(ui.gcode.end).toBe('END_GCODE_TEXT')
  })

  it('light-off Delay reads from Print["Rest After Retract"]', () => {
    const ui = fromDefault({ Print: { 'Rest After Retract': 3 } })
    expect(ui.print.lightOffDelay).toBe(3)
  })

  it('light-off Delay does NOT read from Print["Bottom Rest After Retract"]', () => {
    const ui = fromDefault({ Print: { 'Bottom Rest After Retract': 4 } })
    expect(ui.print?.lightOffDelay).toBeUndefined()
  })

  it('normal Delay Before Lifting reads from Print["Rest Before Lift"]', () => {
    const ui = fromDefault({ Print: { 'Rest Before Lift': 0.4 } })
    expect(ui.print.restBeforeLift).toBe(0.4)
  })

  it('normal Delay Before Lifting does NOT read from Print["Bottom Rest Before Lift"]', () => {
    const ui = fromDefault({ Print: { 'Bottom Rest Before Lift': 0.6 } })
    expect(ui.print?.restBeforeLift).toBeUndefined()
  })

  it('normal Delay After Lifting reads from Print["Rest After Lift"]', () => {
    const ui = fromDefault({ Print: { 'Rest After Lift': 0.5 } })
    expect(ui.print.restAfterLift).toBe(0.5)
  })

  it('normal Retract Distance reads from Print["Retract Second Distance"]', () => {
    const ui = fromDefault({ Print: { 'Retract Second Distance': 9 } })
    expect(ui.motion.normal.retractDistance).toBe(9)
  })

  it('bottom Retract Distance reads from Print["Bottom Retract Second Distance"]', () => {
    const ui = fromDefault({ Print: { 'Bottom Retract Second Distance': 9 } })
    expect(ui.motion.bottom.retractDistance).toBe(9)
  })

  it('normal Retract Distance is strict — NO fallback to legacy "Retract Distance"', () => {
    const ui = fromDefault({
      Print: {
        'Retract Distance': 7, // legacy/unused key
        'Retract Second Distance': 0,
      },
    })
    expect(ui.motion.normal.retractDistance).toBe(0)
  })

  it('bottom Retract Distance is strict — NO fallback to legacy "Bottom Retract Distance"', () => {
    const ui = fromDefault({
      Print: {
        'Bottom Retract Distance': 8,
        'Bottom Retract Second Distance': 0,
      },
    })
    expect(ui.motion.bottom.retractDistance).toBe(0)
  })
})

describe('fromResin — mode field alignment', () => {
  it('light-off Delay reads from normal_wait_before_print', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { normal_wait_before_print: 2 } }))
    expect(ui.print.lightOffDelay).toBe(2)
  })

  it('normal Delay Before Lifting reads from normal_wait_after_print', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { normal_wait_after_print: 0.4 } }))
    expect(ui.print.restBeforeLift).toBe(0.4)
  })

  it('normal Delay After Lifting reads from normal_wait_lift', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { normal_wait_lift: 0.5 } }))
    expect(ui.print.restAfterLift).toBe(0.5)
  })

  it('turn_off_time is ignored — Light-off Delay only follows normal_wait_before_print', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { turn_off_time: 9, normal_wait_before_print: 2 } }))
    expect(ui.print.lightOffDelay).toBe(2)
  })

  it('normal Retract Distance reads from retract_second_dist', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { retract_dist: 5, retract_second_dist: 8 } }))
    expect(ui.motion.normal.retractDistance).toBe(8)
  })

  it('normal Retract Distance ignores legacy retract_dist when retract_second_dist is 0', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { retract_dist: 8, retract_second_dist: 0 } }))
    expect(ui.motion.normal.retractDistance).toBe(0)
  })

  it('normal Retract Distance stays 0 when both retract_dist and retract_second_dist are 0', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { retract_dist: 0, retract_second_dist: 0 } }))
    expect(ui.motion.normal.retractDistance).toBe(0)
  })

  it('bottom Retract Distance reads from bottom_retract_second_dist', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { bottom_retract_dist: 5, bottom_retract_second_dist: 6 } }))
    expect(ui.motion.bottom.retractDistance).toBe(6)
  })

  it('bottom Retract Distance ignores legacy bottom_retract_dist when bottom_retract_second_dist is 0', () => {
    const ui = fromResin(buildResinJson({ modeOverrides: { bottom_retract_dist: 6, bottom_retract_second_dist: 0 } }))
    expect(ui.motion.bottom.retractDistance).toBe(0)
  })

  it('pickResinMode is exported for transform helpers', () => {
    expect(typeof pickResinMode).toBe('function')
  })
})

describe('toEngineDefault — symmetric write-back', () => {
  function makeUi(overrides) {
    return {
      ...seededUiDefaults,
      ...overrides,
      print: { ...seededUiDefaults.print, ...overrides?.print },
      motion: {
        bottom: { ...seededUiDefaults.motion.bottom, ...overrides?.motion?.bottom },
        normal: { ...seededUiDefaults.motion.normal, ...overrides?.motion?.normal },
      },
    }
  }

  it('writes Gcode under Gcode.Start / Interlayer / End keys', () => {
    const ui = makeUi({ gcode: { start: 'S', mid: 'M', end: 'E' } })
    const payload = toEngineDefault(ui)
    expect(payload.Gcode.Start).toBe('S')
    expect(payload.Gcode.Interlayer).toBe('M')
    expect(payload.Gcode.End).toBe('E')
  })

  it('writes Light-off Delay into Print["Rest After Retract"] and Print["Bottom Rest After Retract"]', () => {
    const ui = makeUi({ print: { ...seededUiDefaults.print, lightOffDelay: 3 } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Rest After Retract']).toBe(3)
    expect(payload.Print['Bottom Rest After Retract']).toBe(3)
  })

  it('writes restBeforeLift into Print["Rest Before Lift"]', () => {
    const ui = makeUi({ print: { ...seededUiDefaults.print, restBeforeLift: 0.4 } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Rest Before Lift']).toBe(0.4)
  })

  it('writes restAfterLift into Print["Rest After Lift"]', () => {
    const ui = makeUi({ print: { ...seededUiDefaults.print, restAfterLift: 0.5 } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Rest After Lift']).toBe(0.5)
  })

  it('mirrors normal-layer timing UI values into bottom machine timing keys', () => {
    const ui = makeUi({ print: { ...seededUiDefaults.print, lightOffDelay: 3, restBeforeLift: 0.6, restAfterLift: 0.7 } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Bottom Rest After Retract']).toBe(3)
    expect(payload.Print['Bottom Rest Before Lift']).toBe(0.6)
    expect(payload.Print['Bottom Rest After Lift']).toBe(0.7)
  })

  it('keeps bottom before-lift machine timing at its seeded default', () => {
    const ui = makeUi({})
    const payload = toEngineDefault(ui)
    expect(payload.Print['Bottom Rest Before Lift']).toBe(ui.print.restBeforeLift)
    expect(payload.Print['Bottom Rest After Lift']).toBe(ui.print.restAfterLift)
  })

  it('writes Retract Distance into Print["Retract Second Distance"]', () => {
    const ui = makeUi({ motion: { normal: { ...seededUiDefaults.motion.normal, retractDistance: 9 } } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Retract Second Distance']).toBe(9)
  })

  it('writes Bottom Retract Distance into Print["Bottom Retract Second Distance"]', () => {
    const ui = makeUi({ motion: { bottom: { ...seededUiDefaults.motion.bottom, retractDistance: 9 } } })
    const payload = toEngineDefault(ui)
    expect(payload.Print['Bottom Retract Second Distance']).toBe(9)
  })
})

describe('end-to-end: resolveParams → toEngineDefault — bottom delay isolation', () => {
  it('normal-layer resin wait times still mirror into bottom machine keys', () => {
    const syntheticResin = buildResinJson({ modeOverrides: { normal_wait_after_print: 0.4, normal_wait_lift: 0.5 } })
    const { ui } = resolveParams(defaultJson, syntheticResin)
    expect(ui.print.restBeforeLift).toBe(0.4)
    expect(ui.print.restAfterLift).toBe(0.5)
    const payload = toEngineDefault(ui)
    expect(payload.Print['Rest Before Lift']).toBe(0.4)
    expect(payload.Print['Rest After Lift']).toBe(0.5)
    expect(payload.Print['Bottom Rest Before Lift']).toBe(0.4)
    expect(payload.Print['Bottom Rest After Lift']).toBe(0.5)
  })
})
