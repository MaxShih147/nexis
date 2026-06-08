import { Box3, Vector3 } from 'three'

export const DEFAULT_BUILD_VOLUME_MIN_Z = 0

export function getBuildVolumeBounds(width, height, depth, minZ = DEFAULT_BUILD_VOLUME_MIN_Z) {
  const safeWidth = Number.isFinite(width) ? width : 0
  const safeHeight = Number.isFinite(height) ? height : 0
  const safeDepth = Number.isFinite(depth) ? depth : 0
  const safeMinZ = Number.isFinite(minZ) ? minZ : DEFAULT_BUILD_VOLUME_MIN_Z

  return {
    min: new Vector3(-safeWidth / 2, -safeHeight / 2, safeMinZ),
    max: new Vector3(safeWidth / 2, safeHeight / 2, safeMinZ + safeDepth),
  }
}

export function createBuildVolumeBox(width, height, depth, minZ = DEFAULT_BUILD_VOLUME_MIN_Z) {
  const { min, max } = getBuildVolumeBounds(width, height, depth, minZ)
  return new Box3(min, max)
}

export function isBoxOutOfBuildVolume(targetBox, buildVolumeBox) {
  if (!targetBox?.isBox3 || !buildVolumeBox?.isBox3 || targetBox.isEmpty())
    return false

  return (
    targetBox.min.x < buildVolumeBox.min.x
    || targetBox.max.x > buildVolumeBox.max.x
    || targetBox.min.y < buildVolumeBox.min.y
    || targetBox.max.y > buildVolumeBox.max.y
    || targetBox.min.z < buildVolumeBox.min.z
    || targetBox.max.z > buildVolumeBox.max.z
  )
}

export function getObjectWorldBounds(object) {
  if (!object)
    return new Box3()

  object.updateMatrixWorld(true)
  return new Box3().setFromObject(object, true)
}

export function isObjectOutOfBuildVolume(object, buildVolumeBox) {
  return isBoxOutOfBuildVolume(getObjectWorldBounds(object), buildVolumeBox)
}
