import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function loadLocale(locale) {
  const filePath = resolve(process.cwd(), `src/i18n/locales/${locale}.json`)
  return JSON.parse(readFileSync(filePath, 'utf-8'))
}

const REQUIRED_PRINTER_ERROR_KEYS = [
  'tokenMissing',
  'tokenInvalid',
  'tokenRequired',
  'deviceTokenMissing',
  'deviceTokenInvalid',
  'printerIdRequired',
  'fileRequired',
  'filePathRequired',
  'mainboardIpRequired',
  'invalidIpAddress',
  'machineSlugRequired',
  'resinNameRequired',
  'dentalModeRequired',
  'invalidFileType',
  'limitFileSize',
  'limitFileCount',
  'limitUnexpectedFile',
  'badRequest',
  'fileUploadFailed',
  'recordCreateFailed',
  'recordIdRequired',
  'recordNotFound',
  'recordNotPrintable',
  'printCommandFailed',
  'recordUpdateFailed',
  'printerAckError',
  'mainboardIdRequired',
  'printPauseFailed',
  'printResumeFailed',
  'printStopFailed',
  'recordSyncFailed',
]

const LOCALE_NAMES = ['en', 'tw', 'cn', 'jp']

describe('printer error i18n keys', () => {
  for (const locale of LOCALE_NAMES) {
    describe(`${locale} locale`, () => {
      const messages = loadLocale(locale)

      for (const key of REQUIRED_PRINTER_ERROR_KEYS) {
        it(`has a non-empty errors.printer.${key}`, () => {
          const value = messages?.errors?.printer?.[key]
          expect(value, `errors.printer.${key} missing or empty in ${locale}`).toBeTruthy()
          expect(typeof value).toBe('string')
          expect(value.trim().length).toBeGreaterThan(0)
        })
      }
    })
  }
})
