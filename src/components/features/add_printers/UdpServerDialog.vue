<script setup>
import { useUdpServer } from '@/composables/useUdpServer'
import { computed, inject, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

// DynamicDialog content component uses dialogRef to close
const dialogRef = inject('dialogRef', null)
const { t } = useI18n()

// Public GitHub release for UDP server
const releasePage = 'https://github.com/phrozen3d/PublicAssets/releases/tag/UDP-v1.0.3'
const releaseApi = 'https://api.github.com/repos/phrozen3d/PublicAssets/releases/tags/UDP-v1.0.3'

// Assets state
const loading = ref(false)
const error = ref('')
const assets = ref([])

// Detected platform information
const platform = ref({ os: 'unknown', arch: 'unknown' })
// Allow user to override detected arch (useful on macOS where UA is ambiguous)
const archOverride = ref('')

// Retry state (for "I've started the server")
const retrying = ref(false)
const retryError = ref('')
const { pingUdp } = useUdpServer()

// Fetch release assets from GitHub
async function fetchReleaseAssets() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(releaseApi, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok)
      throw new Error(`GitHub API error: ${res.status}`)
    const data = await res.json()
    assets.value = Array.isArray(data?.assets) ? data.assets : []
  }
  catch (e) {
    error.value = e?.message || 'Failed to load release assets'
  }
  finally {
    loading.value = false
  }
}

async function detectPlatform() {
  const ua = (navigator?.userAgent || '').toLowerCase()
  const uaData = navigator?.userAgentData

  // OS (prefer userAgentData.platform when available)
  let os = 'unknown'
  try {
    const p = (uaData?.platform || '').toLowerCase()
    if (p.includes('win'))
      os = 'windows'
    else if (p.includes('mac'))
      os = 'macos'
  }
  catch {}
  if (os === 'unknown') {
    // Fallback to UA parsing only; avoid deprecated navigator.platform
    if (ua.includes('win'))
      os = 'windows'
    else if (ua.includes('mac'))
      os = 'macos'
  }

  // Arch: prefer high-entropy 'architecture' (Chrome/Edge)
  let arch = 'unknown'
  try {
    if (uaData?.getHighEntropyValues) {
      const info = await uaData.getHighEntropyValues(['architecture'])
      const archStr = (info?.architecture || '').toLowerCase()
      if (archStr.includes('arm'))
        arch = 'arm64'
      else if (archStr.includes('x86'))
        arch = 'x86-x64'
    }
  }
  catch {}
  // Fallback heuristics
  if (arch === 'unknown') {
    if (os === 'macos') {
      if (ua.includes('arm64') || ua.includes('apple silicon') || ua.includes('apple m1') || ua.includes('apple m2') || ua.includes('apple m3'))
        arch = 'arm64'
      else arch = 'x86-x64'
    }
    else if (os === 'windows') {
      arch = 'x86-x64'
    }
    // Avoid deprecated navigator.platform heuristic; rely on manual override if needed
  }

  platform.value = { os, arch }
}

const effectiveArch = computed(() => archOverride.value || platform.value.arch)

const selectedAsset = computed(() => {
  const list = assets.value || []
  const os = platform.value.os
  const arch = effectiveArch.value
  const findBy = pred => list.find(pred)

  if (os === 'windows') {
    return findBy(a => (a?.name || '').toLowerCase().endsWith('.exe')) || null
  }
  if (os === 'macos') {
    if (arch === 'arm64') {
      return findBy((a) => {
        const n = (a?.name || '').toLowerCase()
        return n.includes('arm64') && n.endsWith('.dmg')
      }) || null
    }
    else {
      return findBy((a) => {
        const n = (a?.name || '').toLowerCase()
        return (n.includes('x86-x64') || n.includes('x86_64') || n.includes('x64')) && n.endsWith('.dmg')
      }) || null
    }
  }
  return null
})

function download(url) {
  try {
    const a = document.createElement('a')
    a.href = url
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  }
  catch {
    window.open(url, '_blank')
  }
}

function onDownload() {
  const url = selectedAsset.value?.browser_download_url
  if (url)
    download(url)
  else window.open(releasePage, '_blank')
}

async function onRetry() {
  retryError.value = ''
  retrying.value = true
  try {
    const ok = await pingUdp()
    if (ok) {
      dialogRef?.value?.close({ data: 'retry' })
    }
    else {
      retryError.value = t('common.messages.udpNotReachable')
    }
  }
  finally {
    retrying.value = false
  }
}

onMounted(() => {
  detectPlatform()
  fetchReleaseAssets()
})
</script>

<template>
  <!-- Content-only component for PrimeVue DynamicDialog -->
  <div class="flex flex-col gap-5 w-[40vw] max-w-[720px]">
    <!-- Header -->
    <div class="flex items-start justify-between">
      <div class="flex items-center gap-3">
        <span class="icon-[lucide--server-off] text-xl" />
        <div>
          <h2 class="text-xl font-semibold">
            {{ t('common.labels.udpNotDetected') }}
          </h2>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            {{ t('common.messages.udpStartDesc') }}
          </p>
        </div>
      </div>
      <!-- <Button text icon="icon-[lucide--x]" :pt="{ root: { class: '!size-10' }, icon: { class: '!text-lg' } }" @click="dialogRef?.close()" /> -->
    </div>

    <!-- Body -->
    <div class="space-y-4">
      <div class="space-y-2 text-sm">
        <div class="flex items-center gap-2">
          <span class="icon-[lucide--info] text-zinc-500" />
          <span>
            {{ t('common.labels.detectedPlatform') }}
            <strong class="font-medium">{{ platform.os }}</strong>
            <template v-if="platform.os === 'macos'">
              — {{ t('common.labels.cpu') }}: <strong class="font-medium">{{ effectiveArch }}</strong>
            </template>
          </span>
        </div>
        <div v-if="platform.os === 'macos'" class="flex items-center gap-2">
          <span class="text-zinc-500">{{ t('common.labels.notCorrect') }}</span>
          <div class="flex gap-1">
            <Button size="small" :severity="effectiveArch === 'arm64' ? 'primary' : 'secondary'" :label="t('common.actions.appleSilicon')" @click="archOverride = 'arm64'" />
            <Button size="small" :severity="effectiveArch === 'x86-x64' ? 'primary' : 'secondary'" :label="t('common.actions.intel')" @click="archOverride = 'x86-x64'" />
          </div>
        </div>
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <span class="icon-[lucide--loader-2] animate-spin" />
        {{ t('common.messages.fetchingLinks') }}
      </div>

      <div v-else-if="error" class="text-sm text-red-500">
        {{ error }} — <a :href="releasePage" class="underline" target="_blank" rel="noopener">{{ t('common.labels.openReleasePage') }}</a>
      </div>

      <div v-else class="space-y-3 text-sm text-zinc-600 dark:text-zinc-300">
        <div v-if="selectedAsset" class="flex items-center gap-2">
          <span class="icon-[lucide--download]" />
          <span>{{ t('common.messages.readyToDownload') }} <strong class="font-medium">{{ selectedAsset.name }}</strong></span>
        </div>
        <div v-else>
          {{ t('common.messages.cannotAutoSelect') }}
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="flex justify-between items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-700">
      <div class="text-sm text-red-500" role="alert" aria-live="polite">
        {{ retryError }}
      </div>
      <div class="flex gap-3">
        <Button outlined :loading="retrying" :label="t('common.actions.startedServer')" :pt="{ root: { class: '!text-sm !px-4 !py-2' } }" @click="onRetry" />
        <Button :label="t('common.actions.download')" :pt="{ root: { class: '!text-sm !px-4 !py-2' } }" @click="onDownload" />
      </div>
    </div>
  </div>
</template>
