import { useToast } from '@/composables/useToast'
import i18n from '@/i18n'
import { useProgressStore } from '@/stores/model'
import { buildProjectExportFilename, DEFAULT_PROJECT_NAME, normalizeProjectName } from './projectName'
import { readProject } from './ProjectReader'
import { writeProject } from './ProjectWriter'
import { prepareProjectFileSave, saveProjectFile } from './saveProjectFile'

/**
 * High-level project file manager.
 * Provides save(), open(), and newProject() APIs.
 */
export class ProjectManager {
  /**
   * @param {object} sceneApi  The scene coordinator API object
   * @param {{
   *   getNow?: () => Date
   *   getTimeZone?: () => string
   *   showLoading?: (messages: string[]) => void
   *   hideLoading?: () => void
   * }} [options]
   */
  constructor(sceneApi, options = {}) {
    this._sceneApi = sceneApi
    this._dirty = false
    this._projectName = DEFAULT_PROJECT_NAME
    this._projectNameListeners = new Set()
    this._getNow = options.getNow ?? (() => new Date())
    this._getTimeZone = options.getTimeZone ?? (() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    this._showLoading = options.showLoading ?? defaultShowLoading
    this._hideLoading = options.hideLoading ?? defaultHideLoading
  }

  get dirty() {
    return this._dirty
  }

  get projectName() {
    return this._projectName
  }

  markDirty() {
    this._dirty = true
  }

  setProjectName(name) {
    const nextName = normalizeProjectName(name)
    if (nextName === this._projectName)
      return

    this._projectName = nextName
    this._notifyProjectNameListeners()
  }

  subscribeToProjectName(listener) {
    this._projectNameListeners.add(listener)
    return () => {
      this._projectNameListeners.delete(listener)
    }
  }

  /**
   * Save the current scene as a .3mf file.
   * Prompts for a destination and persists via the browser.
   */
  async save() {
    const models = this._sceneApi.getModels?.() ?? []
    if (models.length === 0) {
      useToast().errorKey('validation.projectFiles.noModelsToExport')
      return null
    }

    const saveTarget = await prepareProjectFileSave(buildProjectExportFilename(this._projectName, {
      date: this._getNow(),
      timeZone: this._getTimeZone(),
    }))
    if (!saveTarget)
      return null

    this._showLoading([
      t('notifications.progress.savingProject'),
      t('notifications.progress.preparing3mfPackage'),
      t('notifications.progress.almostThere'),
    ])

    try {
      const api = this._sceneApi

      const blob = await writeProject({
        getModels: api.getModels,
        camera: api.getCameraState?.() ?? null,
      })

      await saveProjectFile(saveTarget, blob)

      this._dirty = false
      return blob
    }
    finally {
      this._hideLoading()
    }
  }

  /**
   * Open a .3mf file via a file picker dialog.
   */
  async open() {
    const file = await _pickFile('.3mf')
    if (!file)
      return null
    return this.loadFile(file)
  }

  /**
   * Load a .3mf file directly (e.g. from drag-and-drop).
   * @param {File} file
   */
  async loadFile(file) {
    this._showLoading([
      t('notifications.progress.loadingProject'),
      t('notifications.progress.reading3mfPackage'),
      t('notifications.progress.restoringProjectState'),
    ])

    try {
      const result = await readProject(file, this._sceneApi)
      this.setProjectName(file.name.replace(/\.3mf$/i, ''))
      this._dirty = false
      return result
    }
    finally {
      this._hideLoading()
    }
  }

  /**
   * Clear the scene and reset all state for a new project.
   */
  newProject() {
    this._sceneApi.clearScene()
    this.setProjectName(DEFAULT_PROJECT_NAME)
    this._dirty = false
  }

  _notifyProjectNameListeners() {
    this._projectNameListeners.forEach(listener => listener(this._projectName))
  }
}

/**
 * Open a file picker and return the selected file.
 * @param {string} accept  File type filter (e.g. '.3mf')
 * @returns {Promise<File|null>} Resolves with the selected file or `null` when the picker is canceled.
 */
function _pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null
      document.body.removeChild(input)
      resolve(file)
    })
    // Handle cancel (user closes dialog without selecting)
    input.addEventListener('cancel', () => {
      document.body.removeChild(input)
      resolve(null)
    })
    document.body.appendChild(input)
    input.click()
  })
}

function defaultShowLoading(messages) {
  const progressStore = useProgressStore()
  progressStore.setLoading(messages)
}

function defaultHideLoading() {
  const progressStore = useProgressStore()
  progressStore.reset()
}

function t(...args) {
  return i18n.global.t(...args)
}
