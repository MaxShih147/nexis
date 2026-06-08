import { BufferGeometry, Float32BufferAttribute, Mesh, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'
import { autoOrientModel, transformLoopPoints } from '../meshTrimmer'

function createOpenMesh() {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([
    -1,
    -1,
    1,
    1,
    -1,
    1,
    1,
    1,
    1,
    -1,
    1,
    1,
    0,
    0,
    0,
  ], 3))
  return new Mesh(geometry)
}

function toWorldPoints(points, model) {
  return points.map(p => new Vector3(p[0], p[1], p[2]).applyMatrix4(model.matrixWorld).toArray())
}

function getOrientedBoundaryNormal(points, model) {
  const p0 = new Vector3(...points[0])
  const p1 = new Vector3(...points[1])
  const p2 = new Vector3(...points[2])
  const normal = new Vector3()
    .subVectors(p1, p0)
    .cross(new Vector3().subVectors(p2, p0))
    .normalize()

  const boundaryCentroid = points.reduce(
    (sum, p) => sum.add(new Vector3(...p)),
    new Vector3(),
  ).divideScalar(points.length)

  const posAttr = model.geometry.getAttribute('position')
  const meshCentroid = new Vector3()
  for (let i = 0; i < posAttr.count; i++) {
    meshCentroid.add(new Vector3().fromBufferAttribute(posAttr, i).applyMatrix4(model.matrixWorld))
  }
  meshCentroid.divideScalar(posAttr.count)

  if (normal.dot(new Vector3().subVectors(meshCentroid, boundaryCentroid)) > 0)
    normal.negate()

  return normal
}

function getGeometryCentroid(geometry) {
  const posAttr = geometry.getAttribute('position')
  const centroid = new Vector3()
  for (let i = 0; i < posAttr.count; i++) {
    centroid.add(new Vector3().fromBufferAttribute(posAttr, i))
  }
  return centroid.divideScalar(posAttr.count)
}

function getMinWorldZ(model) {
  const posAttr = model.geometry.getAttribute('position')
  const vertex = new Vector3()
  let minZ = Infinity
  model.updateMatrixWorld(true)
  for (let i = 0; i < posAttr.count; i++) {
    vertex.fromBufferAttribute(posAttr, i).applyMatrix4(model.matrixWorld)
    minZ = Math.min(minZ, vertex.z)
  }
  return minZ
}

describe('autoOrientModel', () => {
  it('targets world -Z after the model has been rotated by gizmo', () => {
    const model = createOpenMesh()
    model.rotation.y = Math.PI / 2
    model.position.z = 4
    model.updateMatrixWorld(true)

    const boundaryWorldPoints = toWorldPoints([
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ], model)

    const result = autoOrientModel(model, boundaryWorldPoints)
    const transformedLoops = transformLoopPoints(
      [{ points: boundaryWorldPoints }],
      result.boundaryTransformMatrix,
    )
    const normal = getOrientedBoundaryNormal(transformedLoops[0].points, model)

    expect(result.rotated).toBe(true)
    expect(normal.dot(new Vector3(0, 0, -1))).toBeGreaterThan(0.999)
  })

  it('aligns the bottom to world Z=0 by moving the object instead of translating geometry vertices', () => {
    const model = createOpenMesh()
    model.position.z = 4
    model.updateMatrixWorld(true)

    const initialCentroid = getGeometryCentroid(model.geometry)
    const boundaryWorldPoints = toWorldPoints([
      [-1, -1, 1],
      [1, -1, 1],
      [1, 1, 1],
      [-1, 1, 1],
    ], model)

    autoOrientModel(model, boundaryWorldPoints)

    const finalCentroid = getGeometryCentroid(model.geometry)
    expect(finalCentroid.distanceTo(initialCentroid)).toBeLessThan(1e-6)
    expect(model.position.z).not.toBeCloseTo(4, 6)
    expect(getMinWorldZ(model)).toBeCloseTo(0, 6)
  })
})
