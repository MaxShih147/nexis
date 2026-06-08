<script setup>
import { useAuthForm } from '@/composables/useAuthForm'
import { useToast } from '@/composables/useToast'
import { useUdpServer } from '@/composables/useUdpServer'
import { UdpSyncError, useAuthStore } from '@/stores/useAuthStore'
import { validateLoginValues } from '@/utils/authValidation'
import { labelClass, passwordInputClass, secondaryActionClass, textInputClass } from '@/views/user/authClasses'
import AuthShell from '@/views/user/AuthShell.vue'
import { computed, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const authStore = useAuthStore()

const redirectTo = computed(() => String(route.query.redirect || '/user/dashboard'))
const resending = shallowRef(false)

const LOGIN_ERROR_KEY_BY_CODE = {
  CREDENTIALS_INVALID: 'errors.auth.credentialsInvalid',
  ACCOUNT_NOT_VERIFIED: 'errors.auth.accountNotVerified',
  ACCOUNT_INACTIVE: 'errors.auth.accountInactive',
  SOCIAL_LOGIN_ONLY: 'errors.auth.socialLoginOnly',
  RATE_LIMIT_EXCEEDED: 'errors.auth.rateLimited',
}

const { ensureUdpServer } = useUdpServer()

const { values, errors, submitting, setFieldError, submit } = useAuthForm({
  email: '',
  password: '',
}, validateLoginValues)

async function handleSubmit() {
  try {
    await submit(async (formValues) => {
      await authStore.login(formValues, redirectTo.value)
      toast.success(
        t('notifications.auth.loginSuccess'),
        t('notifications.auth.returnedHome'),
      )
    })
  }
  catch (error) {
    if (error instanceof UdpSyncError) {
      const available = await ensureUdpServer()
      if (available) {
        try {
          await authStore.retrySyncAndNavigate(error.deviceToken, redirectTo.value)
          toast.success(
            t('notifications.auth.loginSuccess'),
            t('notifications.auth.returnedHome'),
          )
        }
        catch {
          await authStore.logout()
          toast.error(t('errors.auth.loginFailed'), t('errors.auth.unexpected'))
        }
      }
      else {
        await authStore.logout()
        toast.error(t('errors.auth.loginFailed'), t('errors.auth.unexpected'))
      }
      return
    }

    const code = error?.response?.data?.code
    const errorKey = LOGIN_ERROR_KEY_BY_CODE[code] || 'errors.auth.unexpected'

    if (code === 'CREDENTIALS_INVALID') {
      setFieldError('email', errorKey)
      setFieldError('password', errorKey)
    }
    else if (LOGIN_ERROR_KEY_BY_CODE[code]) {
      setFieldError('email', errorKey)
    }

    toast.error(t('errors.auth.loginFailed'), t(errorKey))
  }
}

async function handleResendVerification() {
  resending.value = true
  try {
    await authStore.resendVerification(values.email)
    toast.success(t('notifications.auth.verificationResent'), t('notifications.auth.checkInbox'))
  }
  catch {
    toast.error(t('errors.auth.resetFailed'), t('errors.auth.unexpected'))
  }
  finally {
    resending.value = false
  }
}

function goToRegister() {
  router.push('/user/register')
}

function goToForgotPassword() {
  router.push('/user/forgot-password')
}

function startOAuth(provider) {
  void provider
  toast.info(
    t('notifications.auth.oauthComingSoon'),
    t('notifications.auth.oauthComingSoonDescription'),
  )
}
</script>

<template>
  <AuthShell>
    <form class="grid w-full gap-5" @submit.prevent="handleSubmit">
      <div class="grid gap-3 pb-2 text-center">
        <h1 class="font-[var(--auth-font-display)] text-[2.5rem] font-medium tracking-[-0.07em] text-zinc-950 dark:text-white">
          {{ t('features.auth.loginTitle') }}
        </h1>
      </div>

      <Button
        type="button"
        severity="contrast"
        outlined
        class="h-14 w-full justify-center gap-3 rounded-2xl !border-zinc-200 !bg-white !text-base !font-medium !text-zinc-900 transition-all duration-200 hover:!-translate-y-px hover:!border-zinc-300 hover:!bg-zinc-50 hover:shadow-[0_16px_36px_rgba(15,23,42,0.08)] dark:!border-white/10 dark:!bg-zinc-900 dark:!text-white dark:hover:!border-white/24 dark:hover:!bg-[#202020] dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.28)]"
        @click="startOAuth('google')"
      >
        <svg class="h-5 w-5 flex-none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>
        {{ t('features.auth.google') }}
      </Button>

      <div class="relative my-1 flex items-center justify-center">
        <span class="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-zinc-200 dark:bg-white/10" />
        <span class="relative bg-stone-100 px-4 text-[0.72rem] uppercase tracking-[0.3em] text-zinc-400 dark:bg-black dark:text-white/50">
          {{ t('features.auth.orContinueWith') }}
        </span>
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="login-email">{{ t('features.auth.email') }}</label>
        <InputText
          id="login-email"
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
        <Transition name="auth-resend">
          <button
            v-if="errors.email === 'errors.auth.accountNotVerified'"
            type="button"
            :class="secondaryActionClass"
            :disabled="resending"
            @click="handleResendVerification"
          >
            {{ t('features.auth.resendVerification') }}
          </button>
        </Transition>
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="login-password">{{ t('features.auth.password') }}</label>
        <Password
          v-model="values.password"
          input-id="login-password"
          :input-class="passwordInputClass(Boolean(errors.password))"
          :input-props="{ autocomplete: 'current-password' }"
          :input-style="{ width: '100%' }"
          :feedback="false"
          toggle-mask
          :pt="{
            root: { class: 'w-full' },
            pcInputText: { root: { class: passwordInputClass(Boolean(errors.password)) } },
            maskIcon: { class: 'text-white/34 transition-colors duration-200 hover:text-white/62' },
          }"
          :placeholder="t('features.auth.passwordPlaceholder')"
        />
        <div class="min-h-[1rem]">
          <Transition name="auth-error">
            <small v-if="errors.password" role="alert" class="text-xs text-red-400">{{ t(errors.password) }}</small>
          </Transition>
        </div>
      </div>

      <div class="flex items-center justify-end gap-4 pt-1 text-sm">
        <button :class="secondaryActionClass" type="button" @click="goToForgotPassword">
          {{ t('features.auth.forgotPassword') }}
        </button>
      </div>

      <Button
        type="submit"
        class="mt-1 h-14 rounded-2xl border-0 bg-zinc-950 text-lg font-semibold text-white transition-all duration-200 hover:!-translate-y-px hover:!bg-zinc-800 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] active:translate-y-px active:!shadow-none active:!bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:!bg-[#e2e8ee] dark:hover:shadow-[0_18px_38px_rgba(255,255,255,0.12)] dark:active:!bg-white dark:active:!shadow-none"
        :label="t('common.actions.login')"
        :loading="submitting"
      />

      <p class="pt-6 text-center text-sm text-zinc-600 dark:text-zinc-50/80">
        {{ t('features.auth.noAccount') }}
        <button :class="`ml-1 ${secondaryActionClass}`" type="button" @click="goToRegister">
          {{ t('common.actions.register') }}
        </button>
      </p>
    </form>
  </AuthShell>
</template>
