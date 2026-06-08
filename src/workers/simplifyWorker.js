import { simplifyJS } from '@/three/simplify.js'

onmessage = function (e) {
  const aggressiveness = e.data.agressiveness
  const frac = e.data.fraction
  const verts = e.data.vertices
  const tris = e.data.indices

  const g = simplifyJS(verts, tris, frac, aggressiveness)

  globalThis.postMessage({
    vertices: g.vertices,
    triangles: g.triangles,
  }, [g.vertices.buffer, g.triangles.buffer])
}
