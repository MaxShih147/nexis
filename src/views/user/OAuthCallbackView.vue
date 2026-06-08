<script setup>
import { useUdpServer } from '@/composables/useUdpServer'
import { useToast } from '@/composables/useToast'
import { UdpSyncError, useAuthStore } from '@/stores/useAuthStore'
import { onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()
const { ensureUdpServer } = useUdpServer()
const status = shallowRef('loading')

onMounted(async () => {
  const code = String(route.query.code || '')
  const redirectTo = String(route.query.redirect || '/user/dashboard')

  if (!code) {
    status.value = 'error'
    toast.error(t('errors.auth.oauthFailed'), t('errors.auth.unexpected'))
    return
  }

  try {
    await authStore.finishOAuthCallback(code, redirectTo)
    status.value = 'success'
    toast.success(t('notifications.auth.loginSuccess'), t('notifications.auth.returnedHome'))
  }
  catch (error) {
    if (error instanceof UdpSyncError) {
      const available = await ensureUdpServer()
      if (available) {
        try {
          await authStore.retrySyncAndNavigate(error.deviceToken, redirectTo)
          status.value = 'success'
          toast.success(t('notifications.auth.loginSuccess'), t('notifications.auth.returnedHome'))
        }
        catch {
          status.value = 'error'
          await authStore.logout()
          toast.error(t('errors.auth.oauthFailed'), t('errors.auth.unexpected'))
        }
      }
      else {
        status.value = 'error'
        await authStore.logout()
        toast.error(t('errors.auth.oauthFailed'), t('errors.auth.unexpected'))
      }
      return
    }

    status.value = 'error'
    toast.error(
      t('errors.auth.oauthFailed'),
      t(error?.response?.data?.code === 'INVALID_OAUTH_STATE' ? 'errors.auth.invalidOAuthState' : 'errors.auth.unexpected'),
    )
  }
})

function goBack() {
  router.replace('/user/login')
}
</script>

<template>
  <main class="grid min-h-[100svh] place-items-center bg-[linear-gradient(135deg,#f5f5f4_0%,#e7e5e4_70%,#93c5fd_180%)] p-6 dark:bg-[linear-gradient(135deg,#09090b_0%,#18181b_70%,#2563eb_180%)]">
    <div class="grid w-full max-w-[30rem] gap-4 border border-zinc-200 bg-white/95 p-8 text-center shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-zinc-900/10 dark:shadow-none">
      <h1 class="font-[var(--auth-font-display)] text-3xl text-zinc-950">
        {{ t(`features.auth.oauthStatus.${status}`) }}
      </h1>
      <p class="leading-7 text-zinc-600">
        {{ t(`features.auth.oauthStatus.${status}Description`) }}
      </p>
      <Button v-if="status === 'error'" :label="t('features.auth.backToLogin')" @click="goBack" />
      <ProgressSpinner v-else-if="status === 'loading'" stroke-width="4" />
    </div>
  </main>
</template>
