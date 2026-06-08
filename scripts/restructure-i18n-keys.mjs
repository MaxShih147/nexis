import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createNestedMessages, legacyKeyToPath } from '../src/i18n/keyPaths.js'

const projectRoot = process.cwd()
const localeDir = resolve(projectRoot, 'src/i18n/locales')
const localeFiles = ['en', 'tw', 'cn', 'jp']

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function hasLegacyKeys(messages) {
  return Object.keys(messages).some(key => /^(L_|B_|M_|T_)/.test(key) || key.includes(' ') || key === 'L_Size' || key === 'Mirror')
}

function replaceLegacyKeysInSource(filePath, mapping) {
  const source = readFileSync(filePath, 'utf8')
  const nextSource = source.replace(/(['"])([^'"\\]+)\1/g, (match, quote, value) => {
    if (!mapping.has(value))
      return match
    return `${quote}${mapping.get(value)}${quote}`
  })

  if (nextSource !== source)
    writeFileSync(filePath, nextSource)
}

const legacyKeyMap = new Map()

localeFiles.forEach((locale) => {
  const filePath = resolve(localeDir, `${locale}.json`)
  const localeMessages = JSON.parse(readFileSync(filePath, 'utf8'))

  if (hasLegacyKeys(localeMessages)) {
    const { nestedMessages, collisions } = createNestedMessages(localeMessages)

    if (collisions.length) {
      throw new Error(`Key collisions detected in ${locale}: ${JSON.stringify(collisions, null, 2)}`)
    }

    Object.keys(localeMessages).forEach((legacyKey) => {
      legacyKeyMap.set(legacyKey, legacyKeyToPath(legacyKey))
    })

    writeJson(filePath, nestedMessages)
  }
})

const replacementTargets = [
  'src',
]

import { readdirSync, statSync } from 'node:fs'

function walkFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = resolve(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory())
      return walkFiles(fullPath)
    return /\.(vue|js|ts)$/.test(fullPath) ? [fullPath] : []
  })
}

replacementTargets
  .flatMap(dir => walkFiles(resolve(projectRoot, dir)))
  .filter(filePath => !filePath.includes('/i18n/locales/'))
  .forEach((filePath) => {
    const source = readFileSync(filePath, 'utf8')
    for (const match of source.matchAll(/(['"])([^'"\\]+)\1/g)) {
      const value = match[2]
      if (/^(L_|B_|M_|T_)/.test(value) || value === 'Machine Name' || value === 'L_Size' || value === 'Mirror') {
        legacyKeyMap.set(value, legacyKeyToPath(value))
      }
    }
    replaceLegacyKeysInSource(filePath, legacyKeyMap)
  })
