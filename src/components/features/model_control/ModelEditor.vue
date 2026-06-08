<script setup>
import { useModelStore } from '@/stores/model'
import { degToRad, radToDeg } from '@/utils/mathUtils'
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const modelStore = useModelStore()
const lockRatio = ref(false)
const cloneWhenMirror = ref(false)
const three = inject('three')

const isLayOnFaceMode = ref(false)
const isFaceOnTopMode = ref(false)

let unsubscribeModeChange = null

function setModeState({ isLayOnFaceModeActive, isFaceOnTopModeActive } = {}) {
  if (typeof isLayOnFaceModeActive === 'boolean')
    isLayOnFaceMode.value = isLayOnFaceModeActive

  if (typeof isFaceOnTopModeActive === 'boolean')
    isFaceOnTopMode.value = isFaceOnTopModeActive
}

function syncFaceSelectionMode() {
  setModeState({
    isLayOnFaceModeActive: three.isLayOnFaceModeActive
      ? three.isLayOnFaceModeActive()
      : (three.isFaceSelectionModeActive ? three.isFaceSelectionModeActive() : false),
    isFaceOnTopModeActive: three.isFaceOnTopModeActive ? three.isFaceOnTopModeActive() : false,
  })
}

function toggleLayOnFaceMode() {
  if (isLayOnFaceMode.value) {
    isLayOnFaceMode.value = false
    if (three.setLayOnFaceMode)
      three.setLayOnFaceMode(false)
    else
      three.setFaceSelectionMode?.(false)
    return
  }

  isLayOnFaceMode.value = true
  isFaceOnTopMode.value = false
  three.setFaceOnTopMode?.(false)
  if (three.setLayOnFaceMode)
    three.setLayOnFaceMode(true)
  else
    three.setFaceSelectionMode?.(true)
}

function toggleFaceOnTopMode() {
  if (isFaceOnTopMode.value) {
    isFaceOnTopMode.value = false
    three.setFaceOnTopMode?.(false)
    return
  }

  isFaceOnTopMode.value = true
  isLayOnFaceMode.value = false

  if (three.setLayOnFaceMode)
    three.setLayOnFaceMode(false)
  else
    three.setFaceSelectionMode?.(false)

  three.setFaceOnTopMode?.(true)
}

onMounted(() => {
  syncFaceSelectionMode()
  if (three.subscribeFaceSelectionModeChange)
    unsubscribeModeChange = three.subscribeFaceSelectionModeChange(setModeState)
})

onBeforeUnmount(() => {
  unsubscribeModeChange?.()
})


const positionSection = reactive(
  {
    title: 'common.labels.position',
    headerBtn: [
      {
        icon: 'icon-[lucide--arrow-down-to-line]',
        tooltipKey: 'common.tooltips.alignBottom',
        action: () => {
          three.setToBottom()
        },
      },
      {
        icon: 'icon-[lucide--focus] ',
        tooltipKey: 'common.tooltips.alignCenter',
        action: () => {
          three.setToCenter()
        },
      },
    ],
    undoFn: () => {
      three.setToBottom()
      three.setToCenter()
    },
    fields: [
      {
        label: 'x',
        value: computed({
          get: () => modelStore.selectedModel.position.x,
          set: val => three.updatePosition({ x: val, y: modelStore.selectedModel.position.y, z: modelStore.selectedModel.position.z }),
        }),
      },
      {
        label: 'y',
        value: computed({
          get: () => modelStore.selectedModel.position.y,
          set: val => three.updatePosition({ x: modelStore.selectedModel.position.x, y: val, z: modelStore.selectedModel.position.z }),
        }),
      },
      {
        label: 'z',
        value: computed({
          get: () => modelStore.selectedModel.position.z - modelStore.selectedModel.dimensions.height / 2,
          set: val => three.updatePosition({ x: modelStore.selectedModel.position.x, y: modelStore.selectedModel.position.y, z: val + modelStore.selectedModel.dimensions.height / 2 }),
        }),
      },
    ],
  },
)

const rotationHeaderButtons = computed(() => [
  {
    key: 'lay-on-face',
    icon: 'icon-[lucide--mouse-pointer-square]',
    tooltip: t('common.tooltips.layOnFace'),
    action: toggleLayOnFaceMode,
    active: isLayOnFaceMode.value,
  },
  {
    key: 'face-on-top',
    icon: 'icon-[lucide--arrow-up]',
    tooltip: t('common.tooltips.faceOnTop'),
    action: toggleFaceOnTopMode,
    active: isFaceOnTopMode.value,
  },
])

const rotationSection = reactive({
  title: 'common.labels.rotation',
  undoFn: () => {
    three.updateRotation({ x: 0, y: 0, z: 0 })
  },
  fields: [
    // three.js uses rad as rotation unit
    {
      label: 'x',
      value: computed({
        get: () => radToDeg(modelStore.selectedModel.rotation._x),
        set: val => three.updateRotation({ x: degToRad(val), y: modelStore.selectedModel.rotation._y, z: modelStore.selectedModel.rotation._z }),
      }),
      btns: [
        {
          label: '+45',
          icon: 'icon-[ic--outline-rotate-90-degrees-cw]',
          tooltip: 'common.tooltips.rotatePositive45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x + degToRad(45), y: modelStore.selectedModel.rotation._y, z: modelStore.selectedModel.rotation._z })
          },
        },
        {
          label: '-45',
          icon: 'icon-[ic--outline-rotate-90-degrees-ccw]',
          tooltip: 'common.tooltips.rotateNegative45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x - degToRad(45), y: modelStore.selectedModel.rotation._y, z: modelStore.selectedModel.rotation._z })
          },
        },
      ],
    },
    {
      label: 'y',
      value: computed({
        get: () => radToDeg(modelStore.selectedModel.rotation._y),
        set: val => three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: degToRad(val), z: modelStore.selectedModel.rotation._z }),
      }),
      btns: [
        {
          label: '+45',
          icon: 'icon-[ic--outline-rotate-90-degrees-cw]',
          tooltip: 'common.tooltips.rotatePositive45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: modelStore.selectedModel.rotation._y + degToRad(45), z: modelStore.selectedModel.rotation._z })
          },
        },
        {
          label: '-45',
          icon: 'icon-[ic--outline-rotate-90-degrees-ccw]',
          tooltip: 'common.tooltips.rotateNegative45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: modelStore.selectedModel.rotation._y - degToRad(45), z: modelStore.selectedModel.rotation._z })
          },
        },
      ],
    },
    {
      label: 'z',
      value: computed({
        get: () => radToDeg(modelStore.selectedModel.rotation._z),
        set: val => three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: modelStore.selectedModel.rotation._y, z: degToRad(val) }),
      }),
      btns: [
        {
          label: '-45',
          icon: 'icon-[ic--outline-rotate-90-degrees-cw]',
          tooltip: 'common.tooltips.rotateNegative45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: modelStore.selectedModel.rotation._y, z: modelStore.selectedModel.rotation._z - degToRad(45) })
          },
        },
        {
          label: '+45',
          icon: 'icon-[ic--outline-rotate-90-degrees-ccw]',
          tooltip: 'common.tooltips.rotatePositive45',
          action: () => {
            three.updateRotation({ x: modelStore.selectedModel.rotation._x, y: modelStore.selectedModel.rotation._y, z: modelStore.selectedModel.rotation._z + degToRad(45) })
          },
        },
      ],
    },
  ],
})

const scaleSection = reactive({
  title: 'common.labels.scale',
  undoFn: () => {
    three.updateScale({ x: 1, y: 1, z: 1 })
  },
  headerBtn: [
    {
      icon: 'icon-[lucide--expand]',
      tooltipKey: 'common.tooltips.scaleToFit',
      action: () => {
        three.expandModel()
      },
    },
    {
      icon: computed(() => lockRatio.value ? 'icon-[lucide--link]' : 'icon-[lucide--unlink]'),
      tooltipKey: 'common.tooltips.lockRatio',
      action: () => {
        lockRatio.value = !lockRatio.value
      },
    },
  ],
  fields: [
    {
      label: 'x',
      value: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.x * 100),
        set: val => three.updateScale({ x: val / 100, y: modelStore.selectedModel.scale.y, z: modelStore.selectedModel.scale.z }, lockRatio.value),
      }),
      size: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.x * modelStore.selectedModel.dimensions.width),
        set: val => three.updateScale({ x: val / modelStore.selectedModel.dimensions.width, y: modelStore.selectedModel.scale.y, z: modelStore.selectedModel.scale.z }, lockRatio.value),
      }),
    },
    {
      label: 'y',
      value: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.y * 100),
        set: val => three.updateScale({ x: modelStore.selectedModel.scale.x, y: val / 100, z: modelStore.selectedModel.scale.z }, lockRatio.value),
      }),
      size: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.y * modelStore.selectedModel.dimensions.length),
        set: val => three.updateScale({ x: modelStore.selectedModel.scale.x, y: val / modelStore.selectedModel.dimensions.length, z: modelStore.selectedModel.scale.z }, lockRatio.value),
      }),
    },
    {
      label: 'z',
      value: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.z * 100),
        set: val => three.updateScale({ x: modelStore.selectedModel.scale.x, y: modelStore.selectedModel.scale.y, z: val / 100 }, lockRatio.value),
      }),
      size: computed({
        get: () => Math.abs(modelStore.selectedModel.scale.z * modelStore.selectedModel.dimensions.height),
        set: val => three.updateScale({ x: modelStore.selectedModel.scale.x, y: modelStore.selectedModel.scale.y, z: val / modelStore.selectedModel.dimensions.height }, lockRatio.value),
      }),
    },
  ],
})

const mirrorSection = reactive({
  title: 'common.labels.mirror',
  headerBtn: [
    { title: 'X', action: () => { three.mirrorModel('x', cloneWhenMirror.value) } },
    { title: 'Y', action: () => { three.mirrorModel('y', cloneWhenMirror.value) } },
    { title: 'Z', action: () => { three.mirrorModel('z', cloneWhenMirror.value) } },
  ],
  checkBox: [
    { labelKey: 'common.labels.keepOriginalModel', value: false, action: () => { cloneWhenMirror.value = !cloneWhenMirror.value } },
  ],
})
</script>

<template>
  <div class="flex flex-col gap-2 text-sm">
    <div>
      <!-- position section -->
      <EditorPanel :title="t(positionSection.title)" :undo-fn="positionSection.undoFn">
        <template #header-btn>
          <Button v-for="btn in positionSection.headerBtn" :key="btn.icon" v-tooltip.bottom="{ value: t(btn.tooltipKey), showDelay: 300, pt: { text: { class: '!text-xs !font-medium !text-nowrap' } } }" :label="btn.title" :icon="btn.icon" text @click="btn.action" />
        </template>

        <template #body>
          <div v-for="field in positionSection.fields" :key="field.label">
            <ModelEditorFieldRow>
              <template #start>
                <span class="font-light text-zinc-400">{{ field.label }}</span>
              </template>
              <template #end>
                <SteppedInput v-model="field.value" :step="field.step || 0.5" :min-fraction-digits="2" :max-fraction-digits="2" :min="field.min || -Infinity" :max="field.max || Infinity" />
              </template>
            </ModelEditorFieldRow>
          </div>
          <VDivider />
        </template>
      </EditorPanel>

      <!-- rotation section -->
      <EditorPanel :title="t(rotationSection.title)" :undo-fn="rotationSection.undoFn">
        <template #header-btn>
          <Button
            v-for="btn in rotationHeaderButtons"
            :key="`rotation-header-btn-${btn.key}`"
            v-tooltip.bottom="{ value: btn.tooltip, showDelay: 300, pt: { text: { class: '!text-xs !font-medium !text-nowrap' } } }"
            :icon="btn.icon"
            text
            :pt="{
              root: {
                class: ['!p-2', btn.active ? '!text-primary-400 dark:!text-primary-300' : '!text-zinc-400'],
              },
              icon: {
                class: '!text-base',
              },
            }"
            @click="btn.action"
          />
        </template>
        <template #body>
          <div v-for="field in rotationSection.fields" :key="field.label">
            <ModelEditorFieldRow>
              <template #start>
                <span class="font-light text-zinc-400">{{ field.label }}</span>
              </template>
              <template #mid>
                <div class="flex rounded-md justify-center w-20 dark:bg-black/50 mx-auto">
                  <Button
                    v-for="btn in field.btns" :key="btn.label" v-tooltip.bottom="{
                      value: t(btn.tooltip),
                      showDelay: 300,
                      pt: {
                        text: {
                          class: '!text-xs !font-medium',
                        },
                      },
                    }"
                    fluid
                    :icon="btn.icon" text size="small" :pt="{
                      root: {
                        class: '!px-0 group',
                      },
                      icon: {
                        class: '!text-xs !font-light dark:text-zinc-400 dark:group-hover:text-zinc-50',
                      },
                    }" @click="btn.action"
                  />
                </div>
              </template>
              <template #end>
                <SteppedInput v-model="field.value" :step="field.step || 5" :min-fraction-digits="2" :max-fraction-digits="2" :min="field.min || -Infinity" :max="field.max || Infinity" suffix="º" />
              </template>
            </ModelEditorFieldRow>
          </div>
          <VDivider />
        </template>
      </EditorPanel>

      <!-- scale section -->
      <EditorPanel :title="t(scaleSection.title)" :undo-fn="scaleSection.undoFn">
        <template #header-btn>
          <Button v-for="btn in scaleSection.headerBtn" :key="btn.icon" v-tooltip.bottom="{ value: t(btn.tooltipKey), showDelay: 300, pt: { text: { class: '!text-xs !font-medium !text-nowrap' } } }" :label="btn.title" :icon="btn.icon" text @click="btn.action" />
        </template>
        <template #body>
          <div v-for="field in scaleSection.fields" :key="field.label">
            <ModelEditorFieldRow>
              <template #start>
                <span class="font-light text-zinc-400">{{ field.label }}</span>
              </template>
              <template #mid>
                <div class="w-20 m-auto">
                  <SteppedInput v-model="field.size" :step="0.5" :min="0" :max="field.max || Infinity" :max-fraction-digits="2" />
                </div>
              </template>
              <template #end>
                <SteppedInput v-model="field.value" :step="0.5" :min="0" :max="field.max || Infinity" :max-fraction-digits="2" suffix="%" />
              </template>
            </ModelEditorFieldRow>
          </div>
          <VDivider />
        </template>
      </EditorPanel>

      <!-- mirror section -->
      <EditorPanel :title="t(mirrorSection.title)" :undo-fn="mirrorSection.undoFn">
        <template #header-btn>
          <Button v-for="btn in mirrorSection.headerBtn" :key="btn.icon" v-tooltip.bottom="{ value: btn.tooltip, fitContent: true, showDelay: 300, pt: { text: { class: '!text-xs !font-medium' } } }" :label="btn.title" :icon="btn.icon" text @click="btn.action" />
        </template>
        <template #body>
          <div v-for="checkBox in mirrorSection.checkBox" :key="checkBox.label">
            <ModelEditorFieldRow class="pb-2">
              <template #start>
                <div class="flex items-center gap-2">
                  <span class="font-light dark:text-zinc-400">{{ t(checkBox.labelKey) }}</span>
                  <Checkbox v-model="checkBox.value" binary @update:model-value="checkBox.action" />
                </div>
              </template>
            </ModelEditorFieldRow>
            <VDivider />
          </div>
        </template>
      </EditorPanel>
    </div>
  </div>
</template>
