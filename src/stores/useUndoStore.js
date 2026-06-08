import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUndoStore = defineStore('undo', () => {
  const canUndo = ref(false)
  const canRedo = ref(false)
  const undoLabel = ref('')
  const redoLabel = ref('')
  const isExecuting = ref(false)

  return { canUndo, canRedo, undoLabel, redoLabel, isExecuting }
})
