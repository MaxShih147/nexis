import { Box3, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import {
  createBuildVolumeBox,
  getBuildVolumeBounds,
  isBoxOutOfBuildVolume,
} from '../buildVolume'

describe('buildVolume', () => {
  it('creates a centered build volume with min z at 0', () => {
    const { min, max } = getBuildVolumeBounds(200, 120, 180)

    expect(min).toEqual(new Vector3(-100, -60, 0))
    expect(max).toEqual(new Vector3(100, 60, 180))
  })

  it('treats boxes outside any axis as out of build volume', () => {
    const buildVolume = createBuildVolumeBox(200, 120, 180)
    const inside = new Box3(new Vector3(-20, -20, 0), new Vector3(20, 20, 50))
    const belowPlate = new Box3(new Vector3(-20, -20, -1), new Vector3(20, 20, 50))
    const overflowX = new Box3(new Vector3(-20, -20, 0), new Vector3(120, 20, 50))
    const overflowTop = new Box3(new Vector3(-20, -20, 0), new Vector3(20, 20, 181))

    expect(isBoxOutOfBuildVolume(inside, buildVolume)).toBe(false)
    expect(isBoxOutOfBuildVolume(belowPlate, buildVolume)).toBe(true)
    expect(isBoxOutOfBuildVolume(overflowX, buildVolume)).toBe(true)
    expect(isBoxOutOfBuildVolume(overflowTop, buildVolume)).toBe(true)
  })

  it('returns false for empty boxes', () => {
    const buildVolume = createBuildVolumeBox(200, 120, 180)
    const emptyBox = new Box3()

    expect(isBoxOutOfBuildVolume(emptyBox, buildVolume)).toBe(false)
  })
})
