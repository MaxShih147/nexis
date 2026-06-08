/**
 * Debug STL export utilities for ortho auto-processing.
 * Downloads intermediate meshes/blobs as STL files for debugging.
 */
import { saveAs } from 'file-saver'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter'

/**
 * Export a Three.js mesh as a debug STL file (no-op if debug disabled).
 * @param {boolean} debugEnabled - Whether debug export is enabled
 * @param {Object3D} mesh - Three.js mesh to export
 * @param {string} stepName - Name for the debug file
 */
export function debugExportMesh(debugEnabled, mesh, stepName) {
  if (!debugEnabled || !mesh)
    return
  const exporter = new STLExporter()
  const buffer = exporter.parse(mesh, { binary: true })
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  saveAs(blob, `debug_${stepName}.stl`)
}

/**
 * Export a blob as a debug STL file (no-op if debug disabled).
 * @param {boolean} debugEnabled - Whether debug export is enabled
 * @param {Blob} blob - STL blob to export
 * @param {string} stepName - Name for the debug file
 */
export function debugExportBlob(debugEnabled, blob, stepName) {
  if (!debugEnabled || !blob)
    return
  saveAs(blob, `debug_${stepName}.stl`)
}
