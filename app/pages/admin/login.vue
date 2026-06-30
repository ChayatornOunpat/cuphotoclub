<script setup lang="ts">
definePageMeta({ layout: false })

const { t } = useI18n()
const localePath = useLocalePath()
const { loggedIn, fetch: refreshSession } = useUserSession()
if (loggedIn.value) await navigateTo(localePath('/admin'))

const password = ref('')
const error = ref('')
const loading = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    await refreshSession()
    await navigateTo(localePath('/admin'))
  } catch (e) {
    error.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.loginFailed')
  } finally {
    loading.value = false
  }
}

useHead({ title: () => `Admin — CU Photo Club` })
</script>

<template>
  <div class="login">
    <form class="login__card" @submit.prevent="submit">
      <p class="login__brand"><span class="cu">CU</span>PHOTO · Admin</p>
      <h1 class="login__title">{{ t('admin.loginTitle') }}</h1>
      <label class="login__label" for="pw">{{ t('admin.password') }}</label>
      <input id="pw" v-model="password" type="password" class="login__input" autocomplete="current-password" autofocus>
      <p v-if="error" class="login__error">{{ error }}</p>
      <button type="submit" class="login__btn" :disabled="loading">{{ loading ? t('admin.signingIn') : t('admin.signIn') }}</button>
    </form>
  </div>
</template>

<style scoped>
.login { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--hero-bg); padding: 2rem; }
.login__card { width: 100%; max-width: 360px; background: var(--body-bg); padding: 2.5rem; display: flex; flex-direction: column; }
.login__brand { font-size: 0.7rem; font-weight: 500; letter-spacing: 0.18em; color: var(--dark); margin-bottom: 1.75rem; }
.login__brand .cu { color: var(--accent); }
.login__title { font-family: var(--font-serif); font-size: 2rem; font-weight: 200; margin-bottom: 1.75rem; }
.login__label { font-size: 0.54rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.5rem; }
.login__input { font-family: var(--font-sans); font-size: 0.9rem; padding: 0.75rem 0.9rem; border: 1px solid var(--subtle); background: #fff; color: var(--dark); outline: none; transition: border-color 0.2s; }
.login__input:focus { border-color: var(--accent); }
.login__error { color: var(--accent); font-size: 0.72rem; margin-top: 0.75rem; }
.login__btn { margin-top: 1.5rem; font-family: var(--font-sans); font-size: 0.62rem; letter-spacing: 0.2em; text-transform: uppercase; padding: 0.9rem; background: var(--dark); color: #F5F4F0; border: none; cursor: pointer; transition: background 0.2s; }
.login__btn:hover:not(:disabled) { background: var(--accent); }
.login__btn:disabled { opacity: 0.6; cursor: default; }
</style>
