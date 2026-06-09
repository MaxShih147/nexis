import { useProgressStore } from '@/stores/model'
import { DoubleSide, Mesh, MeshPhysicalMaterial } from 'three'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader'

export async function loadModelByFileType(file, frontMaterial, backMaterial) {
  const extension = file.name.split('.').pop().toLowerCase()
  const loader = getLoader(extension)

  if (!loader) {
    throw new Error(`Unsupported file type: .${extension}`)
  }

  return new Promise((resolve, reject) => {
    const progressStore = useProgressStore()
    const index = progressStore.progress.push(0.0) - 1
    const fileName = file.name || 'Untitled'
    const url = URL.createObjectURL(file)
    loader.loadAsync(url, (xhr) => {
      if (xhr.lengthComputable) {
        progressStore.progress[index] = (xhr.loaded / xhr.total) * 100
      }
    })
      .then((geometry) => {
        adjustGeometryPosition(geometry)
        geometry.computeBoundsTree()
        // geometry.computeVertexNormals()
        const mesh = processMesh(geometry, fileName, frontMaterial, backMaterial)
        URL.revokeObjectURL(url)
        resolve(mesh)
      })
      .catch((error) => {
        URL.revokeObjectURL(url)
        reject(error)
      })
  })
}

/**
 * Process a geometry into a fully configured mesh with all required properties
 * @param {BufferGeometry} geometry The geometry to process
 * @param {string} name The name for the mesh
 * @param {Material} frontMaterial The front material to use
 * @param {Material} backMaterial The back material to use
 * @returns {Mesh} The processed mesh object
 */
export function processMesh(geometry, name, frontMaterial) {
  // Single double-sided mesh (the old back-face child doubled draw calls and
  // its default material fetched a CDN matcap per mesh). DoubleSide avoids
  // see-through on the now-removed back material.
  const front = frontMaterial || new MeshPhysicalMaterial({ color: 0xFFFFFF, side: DoubleSide, wireframe: false })

  const mesh = new Mesh(geometry, front)
  mesh.name = name
  mesh.dimensions = getDimensions(mesh.geometry)
  mesh.originalGeometry = mesh.geometry
  mesh.vertices = getVertices(mesh.geometry)
  mesh.facets = getFaceCount(mesh.geometry)
  mesh.castShadow = true

  return mesh
}

function getLoader(extension) {
  switch (extension) {
    case 'stl':
      return new STLLoader()
    case 'obj':
      return new OBJLoader()
    default:
      return null
  }
}

function getVertices(geometry) {
  return geometry.attributes.position.count / 6
}

function getFaceCount(geometry) {
  return geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3
}

function getDimensions(geometry) {
  geometry.computeBoundingBox()
  const boundingBox = geometry.boundingBox
  const min = boundingBox.min
  const max = boundingBox.max
  return {
    width: max.x - min.x,
    length: max.y - min.y,
    height: max.z - min.z,
  }
}

function adjustGeometryPosition(geometry) {
  // geometry.computeBoundingBox()
  // const box = geometry.boundingBox
  // const boxHeight = (box.max.z - box.min.z)
  geometry.center()
// geometry.translate(new Vector3(0, 0, boxHeight / 2))
}
