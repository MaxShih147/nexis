import { describe, expect, it } from 'vitest'
import { DENTAL_MODE_SUPPORT_DEFAULTS } from '../supportDefaults'

describe('DENTAL_MODE_SUPPORT_DEFAULTS', () => {
  const MODES = ['C&B', 'Surgical Guide', 'Splint']

  it.each(MODES)('%s mode defines all required support keys', (mode) => {
    const defaults = DENTAL_MODE_SUPPORT_DEFAULTS[mode]
    expect(defaults).toBeDefined()
    expect(defaults).toHaveProperty('support_head_front_diameter')
    expect(defaults).toHaveProperty('support_head_penetration')
    expect(defaults).toHaveProperty('support_pillar_diameter')
    expect(defaults).toHaveProperty('support_points_density_relative')
    expect(defaults).toHaveProperty('support_critical_angle')
  })

  describe('C&B', () => {
    const d = () => DENTAL_MODE_SUPPORT_DEFAULTS['C&B']
    it('support_head_front_diameter is 0.8', () => expect(d().support_head_front_diameter).toBe(0.8))
    it('support_head_penetration is 0.3', () => expect(d().support_head_penetration).toBe(0.3))
    it('support_pillar_diameter is 1.0', () => expect(d().support_pillar_diameter).toBe(1.0))
    it('support_points_density_relative is 150', () => expect(d().support_points_density_relative).toBe(150))
    it('support_critical_angle is 30', () => expect(d().support_critical_angle).toBe(30))
  })

  describe('Surgical Guide', () => {
    const d = () => DENTAL_MODE_SUPPORT_DEFAULTS['Surgical Guide']
    it('support_head_front_diameter is 0.8', () => expect(d().support_head_front_diameter).toBe(0.8))
    it('support_head_penetration is 0.4', () => expect(d().support_head_penetration).toBe(0.4))
    it('support_pillar_diameter is 1.0', () => expect(d().support_pillar_diameter).toBe(1.0))
    it('support_points_density_relative is 150', () => expect(d().support_points_density_relative).toBe(150))
    it('support_critical_angle is 30', () => expect(d().support_critical_angle).toBe(30))
  })

  describe('Splint', () => {
    const d = () => DENTAL_MODE_SUPPORT_DEFAULTS['Splint']
    it('support_head_front_diameter is 0.8', () => expect(d().support_head_front_diameter).toBe(0.8))
    it('support_head_penetration is 0.4', () => expect(d().support_head_penetration).toBe(0.4))
    it('support_pillar_diameter is 1.0', () => expect(d().support_pillar_diameter).toBe(1.0))
    it('support_points_density_relative is 120', () => expect(d().support_points_density_relative).toBe(120))
    it('support_critical_angle is 30', () => expect(d().support_critical_angle).toBe(30))
  })

  it('all modes share the same support_head_front_diameter (0.8)', () => {
    MODES.forEach(mode =>
      expect(DENTAL_MODE_SUPPORT_DEFAULTS[mode].support_head_front_diameter).toBe(0.8),
    )
  })

  it('all modes share the same support_critical_angle (30)', () => {
    MODES.forEach(mode =>
      expect(DENTAL_MODE_SUPPORT_DEFAULTS[mode].support_critical_angle).toBe(30),
    )
  })
})
