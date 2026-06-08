<script setup>
import { useCooldown } from '@/composables/useCooldown'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/useAuthStore'
import { secondaryActionClass } from '@/views/user/authClasses'
import AuthShell from '@/views/user/AuthShell.vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const COOLDOWN_SECONDS = 60

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const email = computed(() => String(route.query.email || ''))
const resending = shallowRef(false)
const { remaining: cooldownRemaining, start: startCooldown } = useCooldown(COOLDOWN_SECONDS)

async function handleResend() {
  if (cooldownRemaining.value > 0 || resending.value)
    return

  resending.value = true
  try {
    await authStore.resendVerification(email.value)
    toast.success(
      t('notifications.auth.verificationResent'),
      t('notifications.auth.checkInbox'),
    )
    startCooldown()
  }
  catch {
    toast.error(t('errors.auth.resetFailed'), t('errors.auth.unexpected'))
  }
  finally {
    resending.value = false
  }
}

function goToLogin() {
  router.push('/user/login')
}
</script>

<template>
  <AuthShell>
    <div class="flex flex-col items-center w-full gap-6 text-center">
      <h1 class="font-[var(--auth-font-display)] text-[2.5rem] font-medium leading-tight tracking-[-0.07em] text-zinc-950 dark:text-white">
        {{ t('features.auth.emailVerification.title') }}
      </h1>
      <p class="text-base text-zinc-600 dark:text-zinc-50/80">
        {{ t('features.auth.emailVerification.subtitle') }}
      </p>

      <div class="mt-2 flex justify-items-center gap-2 text-sm text-zinc-600 dark:text-zinc-50/80">
        <span>{{ t('features.auth.emailVerification.resendPrompt') }}</span>
        <button
          data-testid="resend-button"
          type="button"
          :class="secondaryActionClass"
          :disabled="cooldownRemaining > 0 || resending"
          @click="handleResend"
        >
          <template v-if="cooldownRemaining > 0">
            {{ t('features.auth.emailVerification.resendCooldown', { seconds: cooldownRemaining }) }}
          </template>
          <template v-else>
            {{ t('features.auth.emailVerification.resend') }}
          </template>
        </button>
      </div>

      <button :class="`mt-4 justify-self-center ${secondaryActionClass}`" type="button" @click="goToLogin">
        {{ t('features.auth.emailVerification.backToLogin') }}
      </button>
    </div>
  </AuthShell>
</template>
