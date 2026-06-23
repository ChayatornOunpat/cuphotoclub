<script setup lang="ts">
definePageMeta({ layout: false })
useHead({ title: 'เข้าสู่ระบบผู้ดูแล' })

const route = useRoute()
const { loggedIn, fetch: refreshSession } = useUserSession()
if (loggedIn.value) await navigateTo('/admin')

const { data: methods } = await useFetch('/api/admin/auth-methods')

const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

const queryError = computed(() => {
  switch (route.query.error) {
    case 'not_allowed': return 'อีเมลนี้ไม่มีสิทธิ์เข้าใช้งานระบบ'
    case 'oauth': return 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ'
    default: return ''
  }
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/admin/login', {
      method: 'POST',
      body: { email: email.value, password: password.value }
    })
    // Refresh the client session so the auth middleware sees us as logged in.
    await refreshSession()
    await navigateTo((route.query.redirect as string) || '/admin')
  } catch (e) {
    const err = e as { data?: { message?: string, statusMessage?: string } }
    error.value = err?.data?.message || err?.data?.statusMessage || 'เข้าสู่ระบบไม่สำเร็จ'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-paper-soft px-4 py-12">
    <div class="w-full max-w-sm">
      <div class="mb-8 text-center">
        <NuxtLink to="/" class="text-xl font-semibold text-ink">{{ strings.brand }}</NuxtLink>
        <p class="mt-1 text-sm text-ink-soft">ระบบจัดการเนื้อหา</p>
      </div>

      <form class="space-y-4 rounded-lg border border-line bg-white p-6 shadow-sm" @submit.prevent="submit">
        <p v-if="error || queryError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {{ error || queryError }}
        </p>

        <UiField label="อีเมล" input-id="email">
          <UiInput id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@cuphotoclub.com" />
        </UiField>
        <UiField label="รหัสผ่าน" input-id="password">
          <UiInput id="password" v-model="password" type="password" autocomplete="current-password" required />
        </UiField>

        <UiButton type="submit" block :loading="loading">เข้าสู่ระบบ</UiButton>
      </form>

      <template v-if="methods?.google">
        <div class="my-4 flex items-center gap-3 text-xs text-ink-soft">
          <span class="h-px flex-1 bg-line" /> หรือ <span class="h-px flex-1 bg-line" />
        </div>
        <a
          href="/auth/google"
          class="flex w-full items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-xs ring-1 ring-inset ring-line hover:bg-paper-soft"
        >
          <svg class="size-4" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
            <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z" />
          </svg>
          เข้าสู่ระบบด้วย Google
        </a>
      </template>
    </div>
  </div>
</template>
