import ProgressDialog from '@/components/features/file_loading/FileLoadingProgressDialog.vue'
import FileSelectionDialog from '@/components/features/file_loading/FileSelectionDialog.vue'
import i18n from '@/i18n'
import { useModelStore } from '@/stores/model'
import { ThreejsManager } from '@/three/ThreejsManager.js'
import { useDialog } from 'primevue/usedialog'
import { useToast } from './useToast'

export function useModelLoader() {
  const threejsManager = new ThreejsManager()
  const dialog = useDialog()
  const toast = useToast()
  const t = (...args) => i18n.global.t(...args)

  const LOADERS = {
    stl: loadSTL,
    // ply: loadPLY,
    // obj: loadOBJ,
    // 3mf: load3MF,
  }

  const VALID_FILE_TYPES = Object.keys(LOADERS).map(ext => `.${ext}`)

  function isValidFileType(file) {
    const fileExtension = getFileExtension(file)
    return VALID_FILE_TYPES.includes(fileExtension)
  }

  /**
   * Process and load files
   * @param {File[]} files - Array of File objects
   * @param {number} fileCountLimit - Maximum number of files allowed
   * @returns {Promise<Array<{success: boolean, file: File, error?: Error}>>} - Array of objects with success, file, and error properties
   */
  async function processFiles(files, fileCountLimit) {
    try {
      const availableFileSlots = getAvailableFileSlots(fileCountLimit)
      const fileList = convertFileListToArray(files) // convert FileList to an array of objects & check file type
      const validFiles = await validateFiles(fileList, availableFileSlots) // check if the user has selected the correct number of files

      if (validFiles.length === 0) {
        return { success: false }
      }

      const loadingDialog = createProgressDialog()

      // load the files if they are valid, otherwise handle the error
      const results = await loadFiles(validFiles)
      closeProgressDialog(loadingDialog)
      return results
    }
    catch (error) {
      handleError(`Error processing files: ${error.message}`)
      return { success: false }
    }
  }

  function getFileExtension(file) {
    return `.${file.name.split('.').pop().toLowerCase()}`
  }

  function getAvailableFileSlots(fileCountLimit) {
    return fileCountLimit - useModelStore().modelCount
  }

  /**
   * Convert FileList to an array of objects & check if file types are valid
   * @param {FileList} fileList - FileList object
   * @returns {object[]} - Array of objects with id, name, type, size, and invalid properties
   */
  function convertFileListToArray(fileList) {
    return Array.from(fileList).map((file, index) => ({
      id: index.toString(),
      name: file.name,
      type: file.type,
      size: file.size.toString(),
      invalid: !isValidFileType(file),
      url: URL.createObjectURL(file),
    }))
  }

  async function validateFiles(files, availableFileSlots) {
    if (availableFileSlots === 0) {
      throw new Error('No file slots available, please remove existing models before adding new ones')
    }

    if (files.length <= availableFileSlots) {
      return files.filter(file => !file.invalid)
    }

    return await promptFileSelection(files, availableFileSlots)
  }

  function promptFileSelection(files, fileCountLimit) {
    return new Promise((resolve, reject) => {
      dialog.open(FileSelectionDialog, {
        props: { header: t('common.labels.selectFiles') },
        data: { files, fileCountLimit },
        onClose: (opt) => {
          if (opt.data) {
            const selectedFiles = files.filter(file => opt.data.some(selected => selected.id === file.id))
            resolve(selectedFiles)
          }
          else {
            reject(new Error(t('common.messages.noFilesSelected')))
          }
        },
      })
    })
  }

  function createProgressDialog() {
    return dialog.open(ProgressDialog, {
      props: {
        header: t('common.labels.loadingFiles'),
        closable: false,
      },
    })
  }

  function closeProgressDialog(dialog) {
    let closeTimeout
    if (dialog) {
      clearTimeout(closeTimeout)
      closeTimeout = setTimeout(() => {
        dialog.close()
      }, 1500)
    }
  }

  async function loadFiles(files) {
    return Promise.all(files.map(loadFile))
  }

  async function loadFile(file) {
    try {
      const fileExtension = getFileExtension(file).slice(1)
      const loader = LOADERS[fileExtension]

      if (!loader) {
        throw new Error(`Unsupported file type: ${fileExtension}`)
      }

      const result = await loader(file)
      return { success: true, result }
    }
    catch (error) {
      return handleFileLoadError(file, error)
    }
  }

  function handleFileLoadError(file, error) {
    handleError(`Error loading ${file.name}: ${error.message}`)
    return { success: false, file, error }
  }

  function handleError(message) {
    toast.error(t('common.messages.errorTitle'), message)
  }

  async function loadSTL(file) {
    const result = await threejsManager.loadSTLFile(file)
    if (!result.success) {
      throw new Error(result.error.message)
    }
    return result
  }

  // async function loadPLY(file) {
  //   const result = await threejsManager.loadPLY(file)
  //   if (!result.success) {
  //     throw new Error('ply not supported yet')
  //   }
  //   return result
  // }

  // async function load3MF(file) {
  //   const result = await threejsManager.loadThreeMF(file)
  //   if (!result.success) {
  //     throw new Error(result.error)
  //   }
  //   return result
  // }

  // async function loadOBJ(file) {
  //   const result = await threejsManager.loadOBJ(file)
  //   if (!result.success) {
  //     throw new Error('obj not supported yet')
  //   }
  //   return result
  // }

  return {
    processFiles,
    isValidFileType,
    VALID_FILE_TYPES,
    createProgressDialog,
    closeProgressDialog,
  }
}
