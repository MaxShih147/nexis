import { BackSide } from 'three'

/**
 * Determine whether a child node should be included in slicing output.
 * Excludes back-face meshes, offset meshes, ortho preview meshes,
 * and drill cylinder meshes.
 * @param {Object3D} node
 * @returns {boolean} True if the node should be included in slicing
 */
export function isSlicableChild(node) {
  if (!node?.isMesh)
    return false
  if (node.material?.side === BackSide)
    return false
  if (node.name === 'offsetMesh')
    return false
  if (node.userData?.isOrthoPreview)
    return false
  if (node.userData?.isDebugOverlay)
    return false
  if (node.name === 'cylinderBrush' || node.name.startsWith('visualHole_'))
    return false
  return true
}
