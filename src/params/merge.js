// Deep merge on UI whitelist with priority and source tracking
import { mappingUtils, uiWhitelist } from './mappingTables'

const { getByPath, setByPath } = mappingUtils

const isEmpty = v => v === undefined || v === null || v === ''

// layers: array of { source: 'ui-default'|'default'|'resin'|'user', data: object }
export function mergeOnWhitelist(layers) {
  const merged = {}
  const sourceInfo = {}
  for (const path of uiWhitelist) {
    let chosen
    let srcLabel
    for (const layer of layers) {
      const v = getByPath(layer.data, path)
      if (!isEmpty(v)) {
        chosen = v
        srcLabel = layer.source
      }
    }
    if (!isEmpty(chosen)) {
      setByPath(merged, path, chosen)
      setByPath(sourceInfo, path, srcLabel)
    }
  }
  return { merged, sourceInfo }
}
