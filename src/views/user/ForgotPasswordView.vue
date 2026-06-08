<script setup>
import { useAuthForm } from '@/composables/useAuthForm'
import { useCooldown } from '@/composables/useCooldown'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/useAuthStore'
import { validateEmailOnly } from '@/utils/authValidation'
import { labelClass, secondaryActionClass, textInputClass } from '@/views/user/authClasses'
import AuthShell from '@/views/user/AuthShell.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const COOLDOWN_SECONDS = 60

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const authStore = useAuthStore()

const { values, errors, submitting, setFieldError, submit } = useAuthForm({
  email: '',
}, validateEmailOnly)
const { remaining: cooldownRemaining, start: startCooldown } = useCooldown(COOLDOWN_SECONDS)
const submitDisabled = computed(() => submitting.value || cooldownRemaining.value > 0)

async function handleSubmit() {
  if (cooldownRemaining.value > 0)
    return

  try {
    const didSubmit = await submit(async (formValues) => {
      await authStore.forgotPassword(formValues.email)
    })

    if (!didSubmit)
      return

    startCooldown()
    toast.success(
      t('notifications.auth.resetEmailSent'),
      t('notifications.auth.checkInbox'),
    )
  }
  catch (error) {
    const status = error?.response?.status
    const code = error?.response?.data?.code

    if (status === 400)
      setFieldError('email', 'validation.auth.emailInvalid')
    else if (status === 429 || code === 'RATE_LIMIT_EXCEEDED')
      setFieldError('email', 'errors.auth.rateLimited')

    toast.error(
      t('errors.auth.resetFailed'),
      t(errors.email || 'errors.auth.unexpected'),
    )
  }
}
</script>

<template>
  <AuthShell>
    <form class="grid w-full gap-5" @submit.prevent="handleSubmit">
      <div class="grid gap-3 pb-1 text-center">
        <h1 class="font-[var(--auth-font-display)] text-[2.5rem] font-medium tracking-[-0.07em] text-zinc-950 dark:text-white">
          {{ t('features.auth.forgotPasswordTitle') }}
        </h1>
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="forgot-email">{{ t('features.auth.email') }}</label>
        <InputText
          id="forgot-email"
          v-model="values.email"
          :class="[textInputClass, errors.email ? 'border-red-500/80' : 'border-white/10']"
          type="email"
          autocomplete="email"
          :placeholder="t('features.auth.emailPlaceholder')"
        />
        <div class="min-h-[1rem]">
          <Transition name="auth-error">
            <small v-if="errors.email" role="alert" class="text-xs text-red-400">{{ t(errors.email) }}</small>
          </Transition>
        </div>
      </div>

      <Button
        type="submit"
        class="mt-2 h-14 rounded-2xl border-0 bg-zinc-950 text-base font-semibold text-white transition-all duration-200 hover:!-translate-y-px hover:!bg-zinc-800 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] active:translate-y-px active:!shadow-none active:!bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:!bg-[#e2e8ee] dark:hover:shadow-[0_18px_38px_rgba(255,255,255,0.12)] dark:active:!bg-white dark:active:!shadow-none"
        :label="cooldownRemaining > 0
          ? t('features.auth.forgotPasswordSubmitCooldown', { seconds: cooldownRemaining })
          : t('features.auth.sendResetLink')"
        :loading="submitting"
        :disabled="submitDisabled"
      />

      <button :class="`justify-self-center ${secondaryActionClass}`" type="button" @click="router.push('/user/login')">
        {{ t('features.auth.backToLogin') }}
      </button>
    </form>
  </AuthShell>
</template>
