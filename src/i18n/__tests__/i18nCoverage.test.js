import { readdirSync, readFileSync, statSync } from 'node:fs'
import { relative, resolve } from 'node:path'
import SelectDentalMode from '@/components/features/printer_settings/SelectDentalMode.vue'
import { flattenMessagePaths, getAllowedRoots } from '@/i18n/keyPaths'
import cnMessages from '@/i18n/locales/cn.json'
import enMessages from '@/i18n/locales/en.json'
import jpMessages from '@/i18n/locales/jp.json'
import twMessages from '@/i18n/locales/tw.json'
import { parse as babelParse } from '@babel/parser'
import { parse as parseTemplate } from '@vue/compiler-dom'
import { parse as parseSFC } from '@vue/compiler-sfc'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { allowedAttributeValues, allowedScriptValuesByFile, allowedTextByFile } from './i18nScanAllowlist'

const projectRoot = process.cwd()
const localesDir = resolve(projectRoot, 'src/i18n/locales')
const srcRoot = resolve(projectRoot, 'src')
const excludedPathFragments = [
  'src/i18n/__tests__/',
  'src/three/wasm/',
  'src/data/',
  'src/three/loaders/fflate.module.js',
]
const templateScanRoots = [
  resolve(projectRoot, 'src/components'),
  resolve(projectRoot, 'src/views'),
]
const templateScanFiles = [
  ...templateScanRoots.flatMap(dir => walkFilesByPattern(dir, /\.vue$/)),
  resolve(projectRoot, 'src/App.vue'),
]
const scriptScanFiles = walkFilesByPattern(srcRoot, /\.(?:vue|js|ts)$/)

const toastMethods = new Set(['error', 'success', 'warn', 'info'])
const metadataPropertyNames = new Set([
  'label',
  'header',
  'placeholder',
  'title',
  'ariaLabel',
  'summary',
  'detail',
  'description',
  'message',
  'tooltip',
])

function toRelativePath(filePath) {
  return relative(projectRoot, filePath).replaceAll('\\', '/')
}

function shouldSkipFile(filePath) {
  const relativePath = toRelativePath(filePath)
  return excludedPathFragments.some(fragment => relativePath.includes(fragment))
}

function walkFilesByPattern(dir, pattern) {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = resolve(dir, entry)
    const stats = statSync(fullPath)
    const relativePath = toRelativePath(fullPath)

    if (stats.isDirectory()) {
      if (excludedPathFragments.some(fragment => relativePath.includes(fragment)))
        return []
      return walkFilesByPattern(fullPath, pattern)
    }

    if (shouldSkipFile(fullPath))
      return []

    return pattern.test(fullPath) ? [fullPath] : []
  })
}

function readLocaleEntries() {
  return readdirSync(localesDir)
    .filter(file => file.endsWith('.json'))
    .map((file) => {
      const locale = file.replace(/\.json$/, '')
      const contents = JSON.parse(readFileSync(resolve(localesDir, file), 'utf8'))
      return { locale, keys: flattenMessagePaths(contents).sort() }
    })
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim()
}

function isAllowedText(file, text) {
  return (allowedTextByFile[file] ?? []).includes(text)
}

function isAllowedAttribute(file, value) {
  return (allowedAttributeValues[file] ?? []).includes(value)
}

function isAllowedScriptValue(file, value) {
  return (allowedScriptValuesByFile[file] ?? []).includes(value)
}

function isTranslationKey(value) {
  return /^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/.test(value)
}

function shouldIgnoreScriptValue(value) {
  return value.length <= 1 || isTranslationKey(value)
}

function hasLetters(value) {
  return /\p{L}/u.test(value)
}

function createTemplateAst(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const { descriptor } = parseSFC(source, { filename: filePath })
  if (!descriptor.template?.content)
    return null
  return parseTemplate(descriptor.template.content, { comments: false })
}

function findHardcodedText(filePath) {
  const relativePath = toRelativePath(filePath)
  const ast = createTemplateAst(filePath)
  if (!ast)
    return []

  const findings = []

  function visit(node) {
    if (node.type === 2) {
      const text = normalizeText(node.content)
      if (text && text.length > 1 && hasLetters(text) && !isAllowedText(relativePath, text))
        findings.push(`${relativePath}: hardcoded text "${text}"`)
    }

    if (node.type === 1) {
      for (const prop of node.props) {
        if (prop.type !== 6)
          continue
        if (!['label', 'header', 'placeholder', 'title', 'aria-label'].includes(prop.name))
          continue

        const value = normalizeText(prop.value?.content ?? '')
        if (!value || !hasLetters(value) || isAllowedAttribute(relativePath, value))
          continue

        findings.push(`${relativePath}: hardcoded ${prop.name}="${value}"`)
      }
    }

    for (const child of node.children ?? [])
      visit(child)
  }

  visit(ast)
  return findings
}

function getScriptContent(filePath, source) {
  if (!filePath.endsWith('.vue'))
    return source

  const { descriptor } = parseSFC(source, { filename: filePath })
  return [
    descriptor.script?.content ?? '',
    descriptor.scriptSetup?.content ?? '',
  ]
    .filter(Boolean)
    .join('\n')
}

function createScriptAst(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const content = getScriptContent(filePath, source)
  if (!content.trim())
    return null

  return babelParse(content, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  })
}

function visitBabel(node, visitor) {
  if (!node || typeof node !== 'object')
    return

  if (Array.isArray(node)) {
    for (const child of node)
      visitBabel(child, visitor)
    return
  }

  visitor(node)

  for (const [key, value] of Object.entries(node)) {
    if (['loc', 'start', 'end', 'leadingComments', 'trailingComments', 'innerComments', 'extra'].includes(key))
      continue
    visitBabel(value, visitor)
  }
}

function extractStaticString(node) {
  if (!node)
    return null
  if (node.type === 'StringLiteral')
    return node.value
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0)
    return node.quasis.map(quasi => quasi.value.cooked ?? '').join('')
  return null
}

function getPropertyName(node) {
  if (!node)
    return null
  if (node.type === 'Identifier')
    return node.name
  if (node.type === 'StringLiteral')
    return node.value
  return null
}

function findHardcodedToastCopy(filePath) {
  const relativePath = toRelativePath(filePath)
  const ast = createScriptAst(filePath)
  if (!ast)
    return []

  const findings = []

  visitBabel(ast, (node) => {
    if (node.type !== 'CallExpression')
      return

    const callee = node.callee
    if (callee?.type !== 'MemberExpression' || callee.computed)
      return
    const isToastIdentifier = callee.object?.type === 'Identifier' && callee.object.name === 'toast'
    const isInlineUseToastCall = callee.object?.type === 'CallExpression'
      && callee.object.callee?.type === 'Identifier'
      && callee.object.callee.name === 'useToast'
      && callee.object.arguments.length === 0

    if (!isToastIdentifier && !isInlineUseToastCall)
      return

    const method = getPropertyName(callee.property)
    if (!toastMethods.has(method))
      return

    for (const arg of node.arguments.slice(0, 2)) {
      const rawValue = extractStaticString(arg)
      const value = rawValue ? normalizeText(rawValue) : ''
      if (!value || !hasLetters(value))
        continue
      if (shouldIgnoreScriptValue(value) || isAllowedScriptValue(relativePath, value))
        continue
      findings.push(`${relativePath}: hardcoded toast.${method}("${value}")`)
    }
  })

  return findings
}

function findHardcodedScriptUiCopy(filePath) {
  const relativePath = toRelativePath(filePath)
  const ast = createScriptAst(filePath)
  if (!ast)
    return []

  const findings = []

  visitBabel(ast, (node) => {
    if (node.type !== 'ObjectProperty')
      return

    const propName = getPropertyName(node.key)
    if (!metadataPropertyNames.has(propName))
      return

    const rawValue = extractStaticString(node.value)
    const value = rawValue ? normalizeText(rawValue) : ''
    if (!value || !hasLetters(value))
      return
    if (shouldIgnoreScriptValue(value) || isAllowedScriptValue(relativePath, value))
      return

    findings.push(`${relativePath}: hardcoded script ${propName}="${value}"`)
  })

  return findings
}

function createTestI18n(locale = 'en') {
  return createI18n({
    legacy: false,
    locale,
    fallbackLocale: 'en',
    messages: {
      en: enMessages,
      tw: twMessages,
      cn: cnMessages,
      jp: jpMessages,
    },
  })
}

function isLowerCamelCase(value) {
  return /^[a-z][a-zA-Z0-9]*$/.test(value)
}

function isArchivedPath(segments) {
  return segments[0] === 'legacy'
}

const SelectStub = defineComponent({
  name: 'Select',
  props: {
    modelValue: String,
    options: Array,
  },
  setup(props, { slots }) {
    return () => h('div', { 'data-testid': 'select-stub' }, [
      slots.value?.({
        value: props.modelValue,
        option: (props.options ?? []).find(option => option.value === props.modelValue) ?? null,
      }),
    ])
  },
})

describe('i18n coverage guardrails', () => {
  it('keeps locale key sets aligned across all supported locales', () => {
    const locales = readLocaleEntries()
    const baseline = locales.find(locale => locale.locale === 'en')

    expect(baseline).toBeDefined()

    const baselineKeys = new Set(baseline.keys)
    const failures = []

    for (const locale of locales) {
      if (locale.locale === 'en')
        continue

      const localeKeys = new Set(locale.keys)
      const missing = [...baselineKeys].filter(key => !localeKeys.has(key))
      const extra = [...localeKeys].filter(key => !baselineKeys.has(key))

      if (missing.length || extra.length) {
        failures.push([
          `${locale.locale}:`,
          missing.length ? `missing -> ${missing.join(', ')}` : null,
          extra.length ? `extra -> ${extra.join(', ')}` : null,
        ].filter(Boolean).join(' '))
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('enforces locale namespace and segment naming rules', () => {
    const locales = readLocaleEntries()
    const failures = []

    for (const locale of locales) {
      for (const key of locale.keys) {
        if (/^(?:L_|B_|M_|T_)/.test(key)) {
          failures.push(`${locale.locale}: legacy key ${key}`)
          continue
        }

        const segments = key.split('.')
        if (!getAllowedRoots().includes(segments[0])) {
          failures.push(`${locale.locale}: invalid root ${segments[0]} in ${key}`)
          continue
        }

        if (isArchivedPath(segments)) {
          if (segments.length < 3) {
            failures.push(`${locale.locale}: invalid archived path ${key}`)
            continue
          }

          if (!getAllowedRoots().includes(segments[1]) || segments[1] === 'legacy') {
            failures.push(`${locale.locale}: invalid archived root ${segments[1]} in ${key}`)
            continue
          }
        }

        const invalidSegment = segments.find(segment => !isLowerCamelCase(segment))
        if (invalidSegment) {
          failures.push(`${locale.locale}: invalid segment ${invalidSegment} in ${key}`)
        }
      }
    }

    expect(failures, failures.join('\n')).toEqual([])
  })

  it('rejects non-allowlisted hardcoded copy in Vue templates', () => {
    const findings = templateScanFiles.flatMap(findHardcodedText)
    expect(findings, findings.join('\n')).toEqual([])
  })

  it('rejects hardcoded toast copy outside translation keys', () => {
    const findings = scriptScanFiles.flatMap(findHardcodedToastCopy)
    expect(findings, findings.join('\n')).toEqual([])
  })

  it('rejects hardcoded UI copy in script metadata', () => {
    const findings = scriptScanFiles.flatMap(findHardcodedScriptUiCopy)
    expect(findings, findings.join('\n')).toEqual([])
  })

  it('updates printer settings copy when locale changes', async () => {
    const i18n = createTestI18n('en')
    const wrapper = mount(SelectDentalMode, {
      props: {
        modelValue: null,
        options: [{ label: 'Surgical Guide', value: 'Surgical Guide' }],
      },
      global: {
        plugins: [i18n],
        stubs: { Select: SelectStub },
      },
    })

    expect(wrapper.text()).toContain('Dental Mode')
    expect(wrapper.text()).toContain('Select Dental Mode')

    i18n.global.locale.value = 'tw'
    await nextTick()

    expect(wrapper.text()).toContain('牙科模式')
    expect(wrapper.text()).toContain('選擇牙科模式')
  })
})
