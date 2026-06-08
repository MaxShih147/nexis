import { ORIENTATION_MODES,isOrientationMode } from '@/constants/orthoModes.js'
const defaultModuleHref = new URL('./dao.js', import.meta.url).href
const defaultWasmHref = new URL('./dao.wasm', import.meta.url).href

// Wrapper for dental auto-orientation WASM module
// Loads the Emscripten-generated dao.js/dao.wasm bundle URLs produced by Vite
// and exposes a simple API for computing rotation for a triangle mesh.
//
// New behavior: native returns [rx, ry, rz] in radians (XYZ). No matrix paths.

export async function createDao(modulePath = defaultModuleHref) {
  const moduleHref = modulePath instanceof URL ? modulePath.href : modulePath
  // Vite keeps this dynamic import untouched via the pragma
  // eslint-disable-next-line
  const loaded = await import(/* @vite-ignore */ moduleHref)
  // Support ESM default, CJS default, or direct export
  const DaoFactory =
    (typeof loaded === 'function' ? loaded : null)
    || (typeof loaded?.default === 'function' ? loaded.default : null)
    || (typeof loaded?.DaoModule === 'function' ? loaded.DaoModule : null)

  if (!DaoFactory) {
    throw new TypeError('dao.js did not export a factory function')
  }
  const M = await DaoFactory({
    locateFile: (path, _prefix) => {
      // Point the wasm loader to the emitted asset
      if (path.endsWith('.wasm')) return defaultWasmHref
      return path
    },
  })

function allocAndCopy(typed) {
  const bytes = typed.byteLength
  const ptr = M._malloc(bytes)
  M.HEAPU8.set(new Uint8Array(typed.buffer, typed.byteOffset, bytes), ptr)
  return ptr
}
function free(p) { if (p) M._free(p) }
function resolveRotationRad(result) {
  const radCandidate = result?.rotationAnglesRad
  let rotationRad = (Array.isArray(radCandidate) || ArrayBuffer.isView(radCandidate))
    ? radCandidate
    : null

  if (!rotationRad && result?.rotationAngles) {
    const degToRad = Math.PI / 180
    rotationRad = [
      result.rotationAngles[0] * degToRad,
      result.rotationAngles[1] * degToRad,
      result.rotationAngles[2] * degToRad,
    ]
  }

  if (!rotationRad || rotationRad.length !== 3) {
    return null
  }

  return rotationRad
}

  return {
    ORIENTATION_MODES,
    isOrientationMode,
    resolveRotationRad,

    computeAutoOrientation(mesh, module = ORIENTATION_MODES.ORTHODONTIC_MODEL) {
      const v = (mesh.vertices instanceof Float32Array)
        ? mesh.vertices
        : new Float32Array(mesh.vertices ?? mesh.positions ?? mesh.verts ?? [])

      let i = (mesh.indices instanceof Uint32Array)
        ? mesh.indices
        : new Uint32Array(mesh.indices ?? mesh.faces ?? mesh.tris ?? [])

      // Convert 1-based faces to 0-based if needed
      let hasZero = false, minv = 0xFFFFFFFF
      for (let k = 0; k < i.length; k++) {
        const t = i[k]
        if (t === 0) hasZero = true
        if (t < minv) minv = t
      }
      if (!hasZero && minv >= 1) {
        for (let k = 0; k < i.length; k++) i[k] = i[k] - 1
      }

      const nv = (v.length / 3) | 0
      if (nv <= 0) throw new Error('mesh.vertices is empty or not multiple of 3')

      if ((i.length % 3) !== 0) throw new Error('indices.length must be multiple of 3')
      const ntri = (i.length / 3) | 0

      let maxIdx = 0
      for (let k = 0; k < i.length; k++) if (i[k] > maxIdx) maxIdx = i[k]
      if (maxIdx >= nv) throw new Error(`index out of range: max=${maxIdx} >= nv=${nv}`)

      const ptrV = allocAndCopy(v)
      const ptrI = allocAndCopy(i)
      const ptrOut = M._malloc(3 * 4) // 3 floats for [rx, ry, rz]

      const rc = M._dao_auto_orient_compute_rotation(ptrV, nv, ptrI, ntri, module, ptrOut)
      if (rc !== 0) {
        free(ptrV); free(ptrI); free(ptrOut)
        throw new Error(`dao_auto_orient_compute_rotation failed (${rc})`)
      }

      const rad = new Float32Array(3)
      rad.set(M.HEAPF32.subarray(ptrOut >> 2, (ptrOut >> 2) + 3))

      free(ptrV); free(ptrI); free(ptrOut)

      // For minimal downstream change: keep degrees field as before
      const deg = 180 / Math.PI
      const angles = [rad[0] * deg, rad[1] * deg, rad[2] * deg]

      return {
        rotationAnglesRad: rad,  // [rx, ry, rz] in radians (XYZ)
        rotationAngles: angles,  // degrees for legacy callers
      }
    },

  }
}
