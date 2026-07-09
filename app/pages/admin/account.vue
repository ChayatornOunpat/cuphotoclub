<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useHead({ title: () => t('adminAccount.title') })

interface AccountProfile {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'editor'
  hasPassword: boolean
  googleLinked: boolean
}

const { data: account } = await useFetch<AccountProfile>('/api/admin/account')

const roleLabels = computed(() => ({
  owner: t('adminUsers.roleOwner'),
  admin: t('adminUsers.roleAdmin'),
  editor: t('adminUsers.roleEditor')
} as const))

const form = reactive({ currentPassword: '', newPassword: '', confirmPassword: '' })
const saving = ref(false)
const error = ref('')
const success = ref('')

// Google-only accounts have no password yet — they set one for the first time.
const hasPassword = computed(() => account.value?.hasPassword ?? true)

function errMsg(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string, statusMessage?: string } }
  return err?.data?.message || err?.data?.statusMessage || fallback
}

async function submit() {
  error.value = ''
  success.value = ''

  if (form.newPassword.length < 8) {
    error.value = t('adminAccount.errTooShort')
    return
  }
  if (form.newPassword !== form.confirmPassword) {
    error.value = t('adminAccount.errMismatch')
    return
  }

  saving.value = true
  try {
    const body: Record<string, string> = { newPassword: form.newPassword }
    if (hasPassword.value) body.currentPassword = form.currentPassword
    await $fetch('/api/admin/account/password', { method: 'POST', body })
    success.value = hasPassword.value ? t('adminAccount.changed') : t('adminAccount.created')
    Object.assign(form, { currentPassword: '', newPassword: '', confirmPassword: '' })
  } catch (e) {
    error.value = errMsg(e, t('adminAccount.saveFailed'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="admin-wrap">
    <header class="page-head">
      <div class="page-head__copy">
        <NuxtLink to="/admin" class="back">{{ t('admin.dashboard') }}</NuxtLink>
        <h1>{{ t('adminAccount.title') }}</h1>
        <p>{{ t('adminAccount.lead') }}</p>
      </div>
    </header>

    <div class="grid">
      <section class="card">
        <h2>{{ t('adminAccount.profileTitle') }}</h2>
        <dl class="profile">
          <div>
            <dt>{{ t('adminUsers.name') }}</dt>
            <dd>{{ account?.name || t('adminUsers.unnamed') }}</dd>
          </div>
          <div>
            <dt>{{ t('adminUsers.email') }}</dt>
            <dd>{{ account?.email }}</dd>
          </div>
          <div>
            <dt>{{ t('adminUsers.colRole') }}</dt>
            <dd>{{ account ? roleLabels[account.role] : '' }}</dd>
          </div>
          <div>
            <dt>{{ t('adminUsers.colLogin') }}</dt>
            <dd>
              <span v-if="account?.hasPassword" class="tag">Password</span>
              <span v-if="account?.googleLinked" class="tag">Google</span>
              <span v-if="!account?.hasPassword && !account?.googleLinked" class="muted">—</span>
            </dd>
          </div>
        </dl>
      </section>

      <section class="card">
        <h2>{{ hasPassword ? t('adminAccount.changeTitle') : t('adminAccount.setTitle') }}</h2>
        <p class="hint">{{ hasPassword ? t('adminAccount.changeHint') : t('adminAccount.setHint') }}</p>
        <form class="pw-form" @submit.prevent="submit">
          <p v-if="error" class="form-error">{{ error }}</p>
          <p v-if="success" class="form-success">{{ success }}</p>

          <label v-if="hasPassword" class="form-field" for="pw-current">
            <span>{{ t('adminAccount.currentPassword') }}</span>
            <input
              id="pw-current"
              v-model="form.currentPassword"
              type="password"
              autocomplete="current-password"
              required
            >
          </label>

          <label class="form-field" for="pw-new">
            <span>{{ t('adminAccount.newPassword') }}</span>
            <input
              id="pw-new"
              v-model="form.newPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            >
            <small>{{ t('adminAccount.minChars') }}</small>
          </label>

          <label class="form-field" for="pw-confirm">
            <span>{{ t('adminAccount.confirmPassword') }}</span>
            <input
              id="pw-confirm"
              v-model="form.confirmPassword"
              type="password"
              autocomplete="new-password"
              minlength="8"
              required
            >
          </label>

          <div class="form-actions">
            <UiButton type="submit" :loading="saving">
              {{ hasPassword ? t('adminAccount.changeButton') : t('adminAccount.setButton') }}
            </UiButton>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }

.page-head { margin-bottom: 2.25rem; }
.page-head__copy { max-width: 680px; }
.back {
  display: inline-block; font-family: var(--font-sans); font-size: 0.56rem;
  letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted);
  text-decoration: none; margin-bottom: 0.65rem;
}
.back:hover { color: var(--accent); }
.page-head h1 {
  font-family: var(--font-serif); font-size: clamp(3rem, 6.6vw, 6rem);
  line-height: 0.95; font-weight: 200; color: var(--dark);
}
.page-head p { margin-top: 0.75rem; color: var(--muted); font-size: 0.78rem; line-height: 1.7; }

.grid {
  display: grid; gap: 1.5rem;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  align-items: start;
}

.card {
  border: 1px solid var(--subtle); background: white;
  padding: 1.5rem 1.5rem 1.75rem;
}
.card h2 {
  font-size: 0.9rem; font-weight: 600; color: var(--dark); margin-bottom: 1.1rem;
}
.hint { color: var(--muted); font-size: 0.74rem; line-height: 1.6; margin: -0.5rem 0 1.1rem; }

.profile { display: grid; gap: 0.9rem; }
.profile div { display: grid; gap: 0.3rem; }
.profile dt {
  color: var(--muted); font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase;
}
.profile dd { color: var(--dark); font-size: 0.82rem; }
.tag {
  display: inline-flex; align-items: center; border: 1px solid var(--subtle);
  padding: 0.2rem 0.5rem; margin-right: 0.4rem; font-size: 0.6rem; color: var(--muted);
}
.muted { color: var(--muted); }

.pw-form { display: grid; gap: 1rem; }
.form-field { display: grid; gap: 0.45rem; }
.form-field span {
  color: var(--muted); font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase;
}
.form-field input {
  width: 100%; border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.82rem; padding: 0.72rem 0.8rem;
  outline: none; transition: border-color 0.15s;
}
.form-field input:focus { border-color: var(--accent); }
.form-field small { color: var(--muted); font-size: 0.62rem; line-height: 1.5; }

.form-error {
  border: 1px solid color-mix(in srgb, #b0243c 36%, var(--subtle));
  color: #b0243c; padding: 0.7rem 0.8rem; font-size: 0.72rem; line-height: 1.5;
}
.form-success {
  border: 1px solid color-mix(in srgb, #24745b 36%, var(--subtle));
  color: #24745b; padding: 0.7rem 0.8rem; font-size: 0.72rem; line-height: 1.5;
}

.form-actions { display: flex; justify-content: flex-end; padding-top: 0.35rem; }

@media (max-width: 760px) {
  .admin-wrap { padding: 2rem 1rem 4rem; }
  .page-head h1 { font-size: clamp(2.6rem, 16vw, 4rem); }
}
</style>
