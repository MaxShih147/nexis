export const allowedTextByFile = {
  'src/components/dialogs/SupportContactDialog.vue': [
    'PHROZEN TECH CO., LTD.',
    'No. 130, Minzu Rd., Hukou Township, Hsinchu County 303001, Taiwan',
  ],
  'src/components/features/model_control/TextEmbossEditor.vue': ['mm'],
}

export const allowedAttributeValues = {
  'src/components/features/basic_settings/SelectLocale.vue': ['EN'],
  'src/components/layout/RightPanel.vue': ['U'],
  'src/views/PrinterDashboard.vue': ['U'],
}

export const allowedScriptValuesByFile = {
  'src/components/features/basic_settings/SelectLocale.vue': ['EN', '繁中', '簡中', '日文'],
  'src/three/managers/AxisHelper.js': ['Back', 'Front'],
  'src/three/project/saveProjectFile.js': ['3MF Project File'],
  'src/three/project/__tests__/ProjectManager.test.js': ['3MF Project File'],
  'src/views/user/OAuthCallbackView.vue': ['loading', 'success', 'error'],
  'src/stores/__tests__/printers.spec.js': ['boom'],
}
