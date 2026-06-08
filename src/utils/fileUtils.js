import { logger } from '@/utils/logger'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'

/**
 * Convert base64 string to Uint8Array
 * @param {string} base64 - The base64 string to convert
 * @returns {Uint8Array} The converted Uint8Array
 */
export function base64ToUint8Array(base64) {
  const binaryStr = atob(base64)
  const len = binaryStr.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

/**
 * Create a zip file from PNGs and GCODE
 * @param {string} jobId - The job ID
 * @param {Array} pngFiles - The PNG files to add to the zip
 * @param {string} gcode - The GCODE to add to the zip
 * @param {Blob} previewImage - The full size preview image
 * @param {Blob} previewImage_cropped - The cropped preview image
 * @returns {Blob} The zip file
 */
export async function createZip(jobId, pngFiles, gcode, previewImage, previewImage_cropped) {
  if (pngFiles.length === 0) {
    logger.error('No PNG files to add to the zip')
  }
  const zip = new JSZip()
  if (pngFiles.length > 0) {
    pngFiles.forEach((file) => {
      zip.file(file.filename, file.blob)
    })
  }
  zip.file('run.gcode', gcode)

  // Add preview images if they exist
  if (previewImage) {
    zip.file('preview.png', previewImage)
  }
  if (previewImage_cropped) {
    zip.file('preview_cropping.png', previewImage_cropped)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  return zipBlob
}

/**
 * Download a zip file
 * @param {Blob} zipBlob - The zip file to download
 * @param {string} name - The name of the zip file
 */
export function downloadZip(zipBlob, name) {
  saveAs(zipBlob, `${name}.zip`)
}

export function downloadSTL(stlBlob, name) {
  saveAs(stlBlob, `${name}.stl`)
  // const url = URL.createObjectURL(stlBlob)
  // const a = document.createElement('a')
  // a.href = url
  // a.download = `${name}.stl`
  // a.click()
}

export function downloadProfileXml(xmlContent, filename) {
  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' })
  saveAs(blob, filename)
}
