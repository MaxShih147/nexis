import { useProgressStore } from '@/stores/model'
import { BackSide, FrontSide, Mesh, MeshMatcapMaterial, MeshPhysicalMaterial, TextureLoader } from 'three'
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
export function processMesh(geometry, name, frontMaterial, backMaterial) {
  // Use provided materials or create defaults if not provided.
  // NOTE: only load the matcap texture when actually building a default back
  // material — doing it unconditionally fired a CDN image fetch per mesh, which
  // made adding many objects extremely slow.
  const front = frontMaterial || new MeshPhysicalMaterial({ color: 0xFFFFFF, side: FrontSide, wireframe: false })
  const back = backMaterial || new MeshMatcapMaterial({
    color: 0xB070B8,
    side: BackSide,
    matcap: new TextureLoader().load('https://cdn.jsdelivr.net/gh/nidorx/matcaps@master/1024/626262_9E9E9E_848484_262626.png'),
  })

  const mesh = new Mesh(geometry, front)
  const backMesh = new Mesh(geometry, back)
  backMesh.raycast = () => {}
  mesh.add(backMesh)
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
