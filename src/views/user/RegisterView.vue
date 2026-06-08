<script setup>
import { useAuthForm } from '@/composables/useAuthForm'
import { useToast } from '@/composables/useToast'
import { useAuthStore } from '@/stores/useAuthStore'
import { getPasswordChecklist, validateRegisterValues } from '@/utils/authValidation'
import { labelClass, passwordInputClass, secondaryActionClass, textInputClass } from '@/views/user/authClasses'
import AuthShell from '@/views/user/AuthShell.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const toast = useToast()
const router = useRouter()
const authStore = useAuthStore()

const { values, errors, submitting, setFieldError, submit, validateField } = useAuthForm({
  email: '',
  password: '',
  firstName: '',
  lastName: '',
}, validateRegisterValues)

const passwordChecklist = computed(() => getPasswordChecklist(values.password))

async function handleSubmit() {
  try {
    const didSubmit = await submit(async (formValues) => {
      await authStore.register(formValues)
    })

    if (!didSubmit)
      return

    router.replace({
      path: '/user/email-verification',
      query: { email: values.email },
    })
  }
  catch (error) {
    const code = error?.response?.data?.code

    if (code === 'EMAIL_FORMAT_INVALID')
      setFieldError('email', 'validation.auth.emailInvalid')
    else if (code === 'PASSWORD_FORMAT_INVALID')
      setFieldError('password', 'validation.auth.passwordWeak')
    else if (code === 'RATE_LIMIT_EXCEEDED')
      setFieldError('email', 'errors.auth.rateLimited')

    toast.error(
      t('errors.auth.registerFailed'),
      t(errors.password || errors.email || 'errors.auth.unexpected'),
    )
  }
}

function goToLogin() {
  router.push('/user/login')
}
</script>

<template>
  <AuthShell>
    <form class="grid w-full gap-4" @submit.prevent="handleSubmit">
      <div class="grid gap-3 pb-2 text-center">
        <h1 class="font-[var(--auth-font-display)] text-[2.5rem] font-medium tracking-[-0.07em] text-zinc-950 dark:text-white">
          {{ t('features.auth.registerTitle') }}
        </h1>
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <div class="grid gap-2">
          <label :class="labelClass" for="register-first-name">{{ t('features.auth.firstName') }}</label>
          <InputText
            id="register-first-name"
            v-model="values.firstName"
            :class="[textInputClass, errors.firstName ? 'border-red-500/80' : 'border-white/10']"
            autocomplete="given-name"
            :placeholder="t('features.auth.firstNamePlaceholder')"
            @update:model-value="validateField('firstName')"
          />
          <div class="min-h-[1rem]">
            <Transition name="auth-error">
              <small v-if="errors.firstName" role="alert" class="text-xs text-red-400">{{ t(errors.firstName) }}</small>
            </Transition>
          </div>
        </div>

        <div class="grid gap-2">
          <label :class="labelClass" for="register-last-name">{{ t('features.auth.lastName') }}</label>
          <InputText
            id="register-last-name"
            v-model="values.lastName"
            :class="[textInputClass, errors.lastName ? 'border-red-500/80' : 'border-white/10']"
            autocomplete="family-name"
            :placeholder="t('features.auth.lastNamePlaceholder')"
            @update:model-value="validateField('lastName')"
          />
          <div class="min-h-[1rem]">
            <Transition name="auth-error">
              <small v-if="errors.lastName" role="alert" class="text-xs text-red-400">{{ t(errors.lastName) }}</small>
            </Transition>
          </div>
        </div>
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="register-email">{{ t('features.auth.email') }}</label>
        <InputText
          id="register-email"
          v-model="values.email"
          :class="[textInputClass, errors.email ? 'border-red-500/80' : 'border-white/10']"
          type="email"
          autocomplete="email"
          :placeholder="t('features.auth.emailPlaceholder')"
          @update:model-value="validateField('email')"
        />
        <div class="min-h-[1rem]">
          <Transition name="auth-error">
            <small v-if="errors.email" role="alert" class="text-xs text-red-400">{{ t(errors.email) }}</small>
          </Transition>
        </div>
      </div>

      <div class="grid gap-2">
        <label :class="labelClass" for="register-password">{{ t('features.auth.password') }}</label>
        <Password
          v-model="values.password"
          input-id="register-password"
          :input-class="passwordInputClass(Boolean(errors.password))"
          :input-props="{ autocomplete: 'new-password' }"
          :input-style="{ width: '100%' }"
          toggle-mask
          :feedback="false"
          :pt="{
            root: { class: 'w-full' },
            pcInputText: { root: { class: passwordInputClass(Boolean(errors.password)) } },
            maskIcon: { class: 'text-white/34 transition-colors duration-200 hover:text-white/62' },
          }"
          :placeholder="t('features.auth.passwordPlaceholder')"
          @update:model-value="validateField('password')"
        />
        <div class="min-h-[1rem]">
          <Transition name="auth-error">
            <small v-if="errors.password" role="alert" class="text-xs text-red-400">{{ t(errors.password) }}</small>
          </Transition>
        </div>
        <ul class="grid gap-2.5 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-white/10 dark:bg-black">
          <li
            v-for="[key, label] in [
              ['minLength', 'validation.auth.passwordRuleMinLength'],
              ['hasUppercase', 'validation.auth.passwordRuleUppercase'],
              ['hasLowercase', 'validation.auth.passwordRuleLowercase'],
              ['hasNumber', 'validation.auth.passwordRuleNumber'],
              ['hasSpecial', 'validation.auth.passwordRuleSpecial'],
              ['noInvalidChars', 'validation.auth.passwordRuleNoInvalidChars'],
            ]"
            :key="key"
            class="flex items-center gap-2.5 transition-colors duration-200"
            :class="key === 'noInvalidChars' && !passwordChecklist[key]
              ? 'text-red-500 dark:text-red-400'
              : passwordChecklist[key]
                ? 'text-emerald-500 dark:text-emerald-400'
                : 'text-zinc-500 dark:text-zinc-500'"
          >
            <Transition name="auth-check" mode="out-in">
              <svg v-if="passwordChecklist[key]" key="check" class="h-3.5 w-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
              <svg v-else-if="key === 'noInvalidChars'" key="xmark" class="h-3.5 w-3.5 flex-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              <svg v-else key="circle" class="h-3.5 w-3.5 flex-none opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
              </svg>
            </Transition>
            {{ t(label) }}
          </li>
        </ul>
      </div>

      <Button
        type="submit"
        class="mt-2 h-14 rounded-2xl border-0 bg-zinc-950 text-base font-semibold text-white transition-all duration-200 hover:!-translate-y-px hover:!bg-zinc-800 hover:shadow-[0_18px_38px_rgba(15,23,42,0.16)] active:translate-y-px active:!shadow-none active:!bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:!bg-[#e2e8ee] dark:hover:shadow-[0_18px_38px_rgba(255,255,255,0.12)] dark:active:!bg-white dark:active:!shadow-none"
        :label="t('common.actions.register')"
        :loading="submitting"
      />

      <p class="pt-4 text-center text-sm text-zinc-600 dark:text-zinc-50/80">
        {{ t('features.auth.haveAccount') }}
        <button :class="`ml-1 ${secondaryActionClass}`" type="button" @click="goToLogin">
          {{ t('common.actions.login') }}
        </button>
      </p>
    </form>
  </AuthShell>
</template>
