import { kdTree } from 'kd-tree-javascript'
import * as THREE from 'three'

/**
 * Generates points on a 3D mesh using Poisson disk sampling
 * @param {THREE.BufferGeometry} geometry - The input 3D mesh geometry
 * @param {number} numPoints - Target number of points to generate
 * @param {number} poissonRadius - Minimum distance between points
 * @returns {Array} Array of [x,y,z] coordinates of sampled points
 */
export function poissonDiskSampling(geometry, numPoints, poissonRadius) {
  // Extract vertex positions from geometry
  const positions = geometry.attributes.position.array
  const numTriangles = positions.length / 9 // Each triangle has 3 vertices * 3 coordinates
  const sampledPoints = []

  // Calculate geometry center for relative positioning
  geometry.computeBoundingBox()
  const center = new THREE.Vector3()
  geometry.boundingBox.getCenter(center)

  // Define distance function for kd-tree
  const distanceFunction = (a, b) => {
    const dx = a[0] - b[0]
    const dy = a[1] - b[1]
    const dz = a[2] - b[2]
    return Math.sqrt(dx * dx + dy * dy + dz * dz)
  }

  // Initialize kd-tree for fast nearest neighbor searches
  // eslint-disable-next-line new-cap
  const tree = new kdTree([], distanceFunction, [0, 1, 2])

  // Main sampling loop
  let attempts = 0
  while (sampledPoints.length < numPoints && attempts < numPoints * 10) {
    // Randomly select a triangle
    const i = Math.floor(Math.random() * numTriangles)
    const v0 = new THREE.Vector3(positions[i * 9], positions[i * 9 + 1], positions[i * 9 + 2])
    const v1 = new THREE.Vector3(positions[i * 9 + 3], positions[i * 9 + 4], positions[i * 9 + 5])
    const v2 = new THREE.Vector3(positions[i * 9 + 6], positions[i * 9 + 7], positions[i * 9 + 8])

    // Convert to relative coordinates from center
    v0.sub(center)
    v1.sub(center)
    v2.sub(center)

    // Generate random barycentric coordinates for point sampling within triangle
    const r1 = Math.random()
    const r2 = Math.random()
    const sqrtR1 = Math.sqrt(r1)

    const a = 1 - sqrtR1
    const b = sqrtR1 * (1 - r2)
    const c = sqrtR1 * r2

    // Calculate point position using barycentric coordinates
    const point = new THREE.Vector3()
    point.addScaledVector(v0, a)
    point.addScaledVector(v1, b)
    point.addScaledVector(v2, c)

    // Only add point if it maintains minimum distance from existing points
    if (tree.nearest([point.x, point.y, point.z], 1, poissonRadius).length === 0) {
      sampledPoints.push([point.x, point.y, point.z])
      tree.insert([point.x, point.y, point.z])
    }

    attempts++
  }

  return sampledPoints
}
