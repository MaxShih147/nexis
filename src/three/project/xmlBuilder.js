/**
 * 3MF XML generation helpers.
 * Builds the OPC-standard XML files required by the 3MF spec.
 */

/**
 * Build [Content_Types].xml for a 3MF package.
 */
export function buildContentTypes() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml" />
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml" />
  <Default Extension="json" ContentType="application/json" />
</Types>`
}

/**
 * Build _rels/.rels for a 3MF package.
 */
export function buildRels() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" />
</Relationships>`
}

/**
 * Convert a Three.js Matrix4 (column-major 4x4) to the 3MF transform attribute string.
 *
 * 3MF uses ROW-VECTOR convention: [x y z 1] * M_3mf
 * Three.js uses COLUMN-VECTOR convention: M_threejs * [x y z 1]^T
 * Therefore M_3mf = transpose(M_threejs).
 *
 * 3MF 12-value order: m00 m01 m02 m10 m11 m12 m20 m21 m22 m30 m31 m32
 * forming the matrix:
 *   | m00 m01 m02 0 |
 *   | m10 m11 m12 0 |
 *   | m20 m21 m22 0 |
 *   | m30 m31 m32 1 |   (translation in last row)
 *
 * Three.js column-major elements[]:
 *   col0: e[0..3]  col1: e[4..7]  col2: e[8..11]  col3: e[12..15]
 *
 * Since M_3mf = M_threejs^T, the 3MF rows are the Three.js columns:
 *   3MF row 0 = Three.js col 0 = e[0], e[1], e[2]
 *   3MF row 1 = Three.js col 1 = e[4], e[5], e[6]
 *   3MF row 2 = Three.js col 2 = e[8], e[9], e[10]
 *   3MF row 3 = Three.js col 3 = e[12], e[13], e[14]  (translation)
 *
 * @param {import('three').Matrix4} matrix
 * @returns {string} The matrix serialized into the 3MF transform attribute format.
 */
function matrix4ToTransform(matrix) {
  const e = matrix.elements
  return [
    e[0],
    e[1],
    e[2],
    e[4],
    e[5],
    e[6],
    e[8],
    e[9],
    e[10],
    e[12],
    e[13],
    e[14],
  ].join(' ')
}

/**
 * Escape XML special characters in a string.
 */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Build the 3D/3dmodel.model XML for a 3MF package.
 *
 * @param {Array<{objectId: number, name: string, geometry: import('three').BufferGeometry, matrix: import('three').Matrix4}>} objects
 *   Each entry: { objectId, name, geometry (in local space), matrix (world matrix) }
 * @returns {string} XML string
 */
export function buildModelXml(objects) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US"
  xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>\n`

  for (const obj of objects) {
    const { objectId, name, geometry } = obj
    const posAttr = geometry.attributes.position
    const indexAttr = geometry.index

    xml += `    <object id="${objectId}" name="${escapeXml(name)}" type="model">\n`
    xml += `      <mesh>\n`
    xml += `        <vertices>\n`

    // Write vertices
    const positions = posAttr.array
    const vertexCount = posAttr.count
    for (let i = 0; i < vertexCount; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      const z = positions[i * 3 + 2]
      xml += `          <vertex x="${x}" y="${y}" z="${z}" />\n`
    }

    xml += `        </vertices>\n`
    xml += `        <triangles>\n`

    // Write triangles
    if (indexAttr) {
      const indices = indexAttr.array
      const triCount = indices.length / 3
      for (let i = 0; i < triCount; i++) {
        xml += `          <triangle v1="${indices[i * 3]}" v2="${indices[i * 3 + 1]}" v3="${indices[i * 3 + 2]}" />\n`
      }
    }
    else {
      // Non-indexed geometry: every 3 vertices form a triangle
      const triCount = vertexCount / 3
      for (let i = 0; i < triCount; i++) {
        xml += `          <triangle v1="${i * 3}" v2="${i * 3 + 1}" v3="${i * 3 + 2}" />\n`
      }
    }

    xml += `        </triangles>\n`
    xml += `      </mesh>\n`
    xml += `    </object>\n`
  }

  xml += `  </resources>\n`
  xml += `  <build>\n`

  for (const obj of objects) {
    const transform = matrix4ToTransform(obj.matrix)
    xml += `    <item objectid="${obj.objectId}" transform="${transform}" />\n`
  }

  xml += `  </build>\n`
  xml += `</model>`

  return xml
}
