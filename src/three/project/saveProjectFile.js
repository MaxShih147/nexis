import { saveAs } from 'file-saver'

const PROJECT_FILE_PICKER_TYPES = [
  {
    description: '3MF Project File',
    accept: {
      'application/octet-stream': ['.3mf'],
    },
  },
]

export async function prepareProjectFileSave(filename) {
  const picker = globalThis.showSaveFilePicker

  if (typeof picker === 'function') {
    try {
      const handle = await picker({
        suggestedName: filename,
        excludeAcceptAllOption: true,
        types: PROJECT_FILE_PICKER_TYPES,
      })
      return { kind: 'handle', handle }
    }
    catch (error) {
      if (error?.name === 'AbortError')
        return null

      throw error
    }
  }

  return {
    kind: 'download',
    filename,
  }
}

// Returns true when the file is persisted.
export async function saveProjectFile(target, blob) {
  if (target.kind === 'handle') {
    const writable = await target.handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return true
  }

  saveAs(blob, target.filename)
  return true
}
