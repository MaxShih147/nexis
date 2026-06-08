import { onUnmounted, ref } from 'vue'

export function useDragDropUpload(options = {}) {
  const {
    onDrop = () => {},
    onDragOver = () => {},
    onDragLeave = () => {},
    fileValidation = () => true,
    maxFileSize = 0,
    allowedFileTypes = [],
  } = options

  const isOverDropZone = ref(false)
  const files = ref([])
  const errors = ref([])
  const dropElement = ref(null)

  const validateFiles = (fileList) => {
    const newFiles = []
    const newErrors = []

    Array.from(fileList).forEach((file) => {
      // Check file size if maxFileSize is set
      if (maxFileSize > 0 && file.size > maxFileSize) {
        newErrors.push(`File "${file.name}" exceeds the maximum size of ${maxFileSize / 1024 / 1024}MB`)
        return
      }

      // Check file extension if allowedFileTypes is provided
      if (allowedFileTypes.length > 0) {
        const extension = file.name.split('.').pop().toLowerCase()
        if (!allowedFileTypes.includes(`.${extension}`) && !allowedFileTypes.includes(extension)) {
          newErrors.push(`File "${file.name}" extension (.${extension}) is not supported`)
          return
        }
      }

      // Custom validation if provided
      if (!fileValidation(file)) {
        newErrors.push(`File "${file.name}" failed custom validation`)
        return
      }

      newFiles.push(file)
    })
    return { validFiles: newFiles, newErrors }
  }

  const handleDrop = (event) => {
    event.preventDefault()
    event.stopPropagation()
    isOverDropZone.value = false

    const droppedFiles = event.dataTransfer?.files || []

    if (droppedFiles.length) {
      const { validFiles, newErrors } = validateFiles(droppedFiles)

      if (validFiles.length) {
        files.value = [...files.value, ...validFiles]
      }

      if (newErrors.length) {
        errors.value = [...errors.value, ...newErrors]
      }

      onDrop(validFiles, newErrors)
    }
  }

  const handleDragOver = (event) => {
    event.preventDefault()
    event.stopPropagation()
    isOverDropZone.value = true
    onDragOver(event)
  }

  const handleDragLeave = (event) => {
    event.preventDefault()
    event.stopPropagation()
    isOverDropZone.value = false
    onDragLeave(event)
  }

  const clearFiles = () => {
    files.value = []
  }

  const clearErrors = () => {
    errors.value = []
  }

  const setupDropZone = (element) => {
    if (!element)
      return

    dropElement.value = element
    element.addEventListener('drop', handleDrop)
    element.addEventListener('dragover', handleDragOver)
    element.addEventListener('dragleave', handleDragLeave)
  }

  const cleanupDropZone = () => {
    if (!dropElement.value)
      return

    dropElement.value.removeEventListener('drop', handleDrop)
    dropElement.value.removeEventListener('dragover', handleDragOver)
    dropElement.value.removeEventListener('dragleave', handleDragLeave)
  }

  onUnmounted(() => {
    cleanupDropZone()
  })

  return {
    isOverDropZone,
    files,
    errors,
    setupDropZone,
    cleanupDropZone,
    clearFiles,
    clearErrors,
    validateFiles,
  }
}
