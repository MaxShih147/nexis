<script setup>
import { useUdpServer } from '@/composables/useUdpServer'
import { usePrintersStore } from '@/stores/printers.js'
import { storeToRefs } from 'pinia'
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

// Props
const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
})

// Emits
defineEmits(['update:visible', 'printerConnected'])

const { t } = useI18n()
const printersStore = usePrintersStore()
const { ensureUdpServer } = useUdpServer()

const { nearbyPrinters, isSearching } = storeToRefs(printersStore)

const ipInput = ref('')
const ipError = ref('')
const isConnectingByIP = ref(false)

const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/

function validateIp(value) {
  if (!value.trim())
    return t('common.messages.provideIpAddress')
  if (!IPV4_RE.test(value.trim()))
    return t('validation.addPrinters.invalidIpFormat')
  return ''
}

async function connectByIP() {
  ipError.value = validateIp(ipInput.value)
  if (ipError.value)
    return
  isConnectingByIP.value = true
  try {
    await printersStore.connectPrinterByIP(ipInput.value.trim())
    ipInput.value = ''
  }
  catch {
    // errors are shown by the store via toast
  }
  finally {
    isConnectingByIP.value = false
  }
}

async function fetchNearby() {
  const ok = await ensureUdpServer()
  if (!ok)
    return
  printersStore.getNearbyPrinters()
}

watch(() => props.visible, (newVal) => {
  if (newVal) {
    fetchNearby()
  }
})
</script>

<template>
  <Dialog :visible="visible" pt:root:class="!border-0 !bg-transparent" pt:mask:class="backdrop-blur-sm" @update:visible="$emit('update:visible', $event)">
    <template #container="{ closeCallback }">
      <div class="flex flex-col px-8 py-8 gap-6 rounded-2xl bg-zinc-100 dark:bg-neutral-900 w-[45vw] max-w-[800px]">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <h2 class="text-xl font-semibold">
              {{ t('common.labels.searchingPrinters') }}
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <Button
              text
              icon="icon-[lucide--refresh-cw]"
              :class="{ 'animate-spin': isSearching }"
              :disabled="isSearching"
              :pt="{
                root: { class: '!size-10' },
                icon: { class: '!text-lg' },
              }"
              @click="fetchNearby()"
            />
            <Button
              text
              icon="icon-[lucide--x]"
              :pt="{
                root: { class: '!size-10' },
                icon: { class: '!text-lg' },
              }"
              @click="closeCallback"
            />
          </div>
        </div>

        <!-- IP Connection -->
        <div class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {{ t('features.addPrinters.connectByIp') }}
          </h3>
          <div class="flex gap-2">
            <div class="flex-1 flex flex-col gap-1">
              <InputText
                v-model="ipInput"
                class="w-full !text-sm font-mono"
                placeholder="192.168.1.100"
                :disabled="isConnectingByIP"
                :invalid="!!ipError"
                @keyup.enter="connectByIP"
                @input="ipError = ''"
              />
              <span v-if="ipError" class="text-xs text-red-600 dark:text-red-400">{{ ipError }}</span>
            </div>
            <Button
              :loading="isConnectingByIP"
              :disabled="isConnectingByIP"
              :label="t('common.actions.connect')"
              :pt="{
                root: { class: '!text-sm !px-4 !py-2 shrink-0' },
              }"
              @click="connectByIP"
            />
          </div>
        </div>

        <div class="border-t border-zinc-200 dark:border-zinc-700" />

        <!-- Nearby Printers -->
        <div class="flex-1 flex flex-col">
          <h3 class="text-lg font-medium mb-4 flex items-center gap-2">
            <span class="icon-[lucide--wifi]" />
            {{ t('common.labels.nearbyPrinters') }}
            <span v-if="!isSearching" class="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              ({{ nearbyPrinters.length }})
            </span>
          </h3>

          <div class="flex-1 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
            <!-- Loading State -->
            <div v-if="isSearching" class="flex items-center justify-center h-48">
              <div class="flex flex-col items-center gap-3">
                <div class="animate-spin">
                  <span class="icon-[lucide--loader-2] text-2xl text-zinc-400" />
                </div>
                <span class="text-sm text-zinc-500 dark:text-zinc-400">{{ t('common.messages.broadcastingUdp') }}</span>
              </div>
            </div>

            <!-- Empty State -->
            <div v-else-if="nearbyPrinters.length === 0" class="flex items-center justify-center h-48">
              <div class="flex flex-col items-center gap-3 text-zinc-500 dark:text-zinc-400">
                <span class="icon-[lucide--search-x] text-3xl" />
                <span class="text-sm">{{ t('common.messages.noNearbyPrinters') }}</span>
              </div>
            </div>

            <!-- Printer List -->
            <div v-else class="divide-y divide-zinc-200 dark:divide-zinc-700 max-h-[60vh] overflow-y-auto no-scrollbar">
              <div
                v-for="printer in nearbyPrinters"
                :key="printer.id"
                class="p-4 hover:bg-zinc-50 dark:hover:bg-neutral-800 cursor-pointer transition-colors relative"
                @click="printersStore.connectPrinter(printer)"
              >
                <!-- Connection overlay -->
                <div v-show="printer.status !== 'offline' && printer.status !== 'error'" class="absolute inset-0 bg-zinc-50/80 dark:bg-neutral-800/80 flex items-center justify-center rounded delay-300">
                  <div class="flex items-center gap-2">
                    <div class="flex items-center justify-center">
                      <span class="icon-[lucide--circle-check-big] text-lg" />
                    </div>
                    <span class="text-sm font-medium">{{ t('common.actions.connected') }}</span>
                  </div>
                </div>

                <div class="flex items-center justify-between">
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                      <h4 class="font-medium">
                        {{ printer.name }}
                      </h4>
                      <div class="flex items-center">
                        <!-- <span
                          :class="{
                            'icon-[lucide--wifi]': printer.status === 'connected',
                            'icon-[lucide--wifi-off]': printer.status === 'offline',
                          }"
                          class="text-sm"
                        /> -->
                        <span
                          v-if="printer.status === 'connected'"
                          class="text-sm icon-[lucide--circle-check-big]"
                        />
                      </div>
                    </div>
                    <div class="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                      <div class="flex justify-between">
                        <span>{{ t('common.labels.model') }}:</span>
                        <span>{{ printer.model }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span>{{ t('common.labels.ip') }}:</span>
                        <span class="font-mono">{{ printer.ip }}</span>
                      </div>
                      <div class="flex justify-between">
                        <span>{{ t('common.labels.firmware') }}:</span>
                        <span>{{ printer.firmware }}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
          <Button
            outlined
            :label="t('common.actions.close')"
            :pt="{
              root: { class: '!text-sm !px-4 !py-2' },
            }"
            @click="closeCallback"
          />
          <Button
            :disabled="isSearching"
            :pt="{
              root: { class: '!text-sm !px-4 !py-2' },
              icon: { class: '!text-sm' },
            }"
            @click="fetchNearby()"
          >
            <span class="icon-[lucide--refresh-cw]" :class="{ 'animate-spin': isSearching }" />
            {{ t('common.actions.refresh') }}
          </Button>
        </div>
      </div>
    </template>
  </Dialog>
</template>
