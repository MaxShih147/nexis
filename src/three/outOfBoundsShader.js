import { Vector3 } from 'three'
import { getBuildVolumeBounds } from './buildVolume'

/**
 * Out-of-bounds shader injection for MeshMatcapMaterial.
 *
 * Injects custom shader code via onBeforeCompile to tint fragments
 * outside the printer build volume red. The tint keeps each fragment's own
 * alpha (a pure colour change) and does NOT force material.transparent, so it
 * stays robust against the transparent render pass (gizmo / back faces /
 * overlapping models) that otherwise washed the tint out to white.
 */

const OOB_COLOR = 'vec3(1.0, 0.4, 0.44)' // #FF6670
const OOB_MIX = '0.75' // blend factor toward the OOB colour

/**
 * Create a shared set of OOB uniforms.
 */
export function createOobUniforms() {
  return {
    uBuildMin: { value: new Vector3(-67, -37.5, 0) },
    uBuildMax: { value: new Vector3(67, 37.5, 200) },
    uOobEnabled: { value: true },
  }
}

/**
 * Attach out-of-bounds visualization to a material using shared uniforms.
 *
 * @param {Material} material - The material to modify
 * @param {object} uniforms - Shared uniforms from createOobUniforms()
 */
export function attachOutOfBoundsShader(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    // Merge our uniforms into the shader
    shader.uniforms.uBuildMin = uniforms.uBuildMin
    shader.uniforms.uBuildMax = uniforms.uBuildMax
    shader.uniforms.uOobEnabled = uniforms.uOobEnabled

    // Vertex shader: pass world position to fragment
    shader.vertexShader = shader.vertexShader.replace(
      'void main() {',
      `varying vec3 vOobWorldPos;
void main() {`,
    )
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
vOobWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
    )

    // Fragment shader: check bounds and tint
    shader.fragmentShader = shader.fragmentShader.replace(
      'void main() {',
      `uniform vec3 uBuildMin;
uniform vec3 uBuildMax;
uniform bool uOobEnabled;
varying vec3 vOobWorldPos;
void main() {`,
    )
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
if (uOobEnabled) {
  bool oob = vOobWorldPos.x < uBuildMin.x || vOobWorldPos.x > uBuildMax.x ||
             vOobWorldPos.y < uBuildMin.y || vOobWorldPos.y > uBuildMax.y ||
             vOobWorldPos.z < uBuildMin.z || vOobWorldPos.z > uBuildMax.z;
  if (oob) {
    // Keep the fragment's own alpha: the OOB tint is a pure colour change and
    // never introduces extra transparency. (Forcing a low alpha here made OOB
    // regions render in the transparent pass, where the gizmo / back-face mesh
    // / overlapping models blended them into a washed-out "white".)
    gl_FragColor = vec4(mix(gl_FragColor.rgb, ${OOB_COLOR}, ${OOB_MIX}), gl_FragColor.a);
  }
}`,
    )
  }

  // NOTE: do NOT force material.transparent here. The OOB tint keeps the base
  // fragment alpha, so it works whether the material is opaque (normal) or
  // transparent (hollow mode toggles transparent/opacity itself). Forcing
  // transparency previously pushed the whole model into the transparent pass,
  // where the TransformControls gizmo / back-face mesh / overlapping models
  // blended the OOB regions into a washed-out "white".

  // Force unique shader cache key so Three.js compiles our modified version
  material.customProgramCacheKey = () => `oob-v2-${material.side}`
}

/**
 * Update build volume bounds on a set of OOB uniforms.
 *
 * @param {object} uniforms - The shared uniforms from createOobUniforms()
 * @param {number} width - Build plate width (X)
 * @param {number} height - Build plate height (Y)
 * @param {number} depth - Build volume Z height
 */
export function updateBuildVolume(uniforms, width, height, depth) {
  const { min, max } = getBuildVolumeBounds(width, height, depth)
  uniforms.uBuildMin.value.copy(min)
  uniforms.uBuildMax.value.copy(max)
}
