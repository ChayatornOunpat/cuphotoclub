<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()
const { data: settings } = useSiteSettings()

const form = reactive({ name: '', email: '', subject: '', message: '' })
const sending = ref(false)
const sent = ref(false)
const error = ref('')

const officialSocials = {
  facebook: 'https://www.facebook.com/cuphoto',
  instagram: 'https://www.instagram.com/cuphotoclub/',
  x: 'https://x.com/CUPhotoClubs',
  linktree: 'https://linktr.ee/CUPhotoClub'
}

async function submit() {
  sending.value = true
  error.value = ''
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      body: { name: form.name, email: form.email, subject: form.subject || undefined, message: form.message }
    })
    sent.value = true
  } catch (e) {
    error.value = (e as { data?: { message?: string } })?.data?.message || t('contact.sendFailed')
  } finally {
    sending.value = false
  }
}

const socials = computed(() =>
  [
    { url: settings.value?.facebookUrl || officialSocials.facebook, icon: 'simple-icons:facebook', label: 'Facebook' },
    { url: settings.value?.instagramUrl || officialSocials.instagram, icon: 'simple-icons:instagram', label: 'Instagram' },
    { url: officialSocials.x, icon: 'simple-icons:x', label: 'X' },
    { url: officialSocials.linktree, icon: 'simple-icons:linktree', label: 'Linktree' },
    { url: settings.value?.lineUrl, icon: 'simple-icons:line', label: 'LINE' }
  ].filter(s => s.url)
)

useSeoMeta({ title: () => t('contact.title'), description: () => t('contact.metaDescription') })
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <div class="grid gap-12 lg:grid-cols-2">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{{ t('contact.title') }}</h1>
        <p class="mt-3 text-ink-soft">{{ t('contact.lead') }}</p>

        <dl class="mt-8 space-y-4 text-sm">
          <div v-if="settings?.contactEmail" class="flex items-center gap-3">
            <Icon name="heroicons:envelope" class="size-5 text-ink-soft" />
            <a :href="`mailto:${settings.contactEmail}`" class="text-ink hover:text-accent">{{ settings.contactEmail }}</a>
          </div>
        </dl>

        <div v-if="socials.length" class="mt-6 flex gap-4">
          <a v-for="s in socials" :key="s.label" :href="s.url || undefined" target="_blank" rel="noopener" :aria-label="s.label" class="text-ink-soft hover:text-accent">
            <Icon :name="s.icon" class="size-6" />
          </a>
        </div>
      </div>

      <div class="rounded-lg border border-line bg-white p-6 sm:p-8">
        <div v-if="sent" class="flex h-full flex-col items-center justify-center py-8 text-center">
          <Icon name="heroicons:check-circle" class="size-12 text-green-500" />
          <p class="mt-4 font-semibold text-ink">{{ t('contact.sentTitle') }}</p>
          <p class="mt-1 text-sm text-ink-soft">{{ t('contact.sentBody') }}</p>
        </div>
        <form v-else class="space-y-4" @submit.prevent="submit">
          <p v-if="error" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ error }}</p>
          <UiField :label="t('contact.name')" input-id="c-name">
            <UiInput id="c-name" v-model="form.name" required />
          </UiField>
          <UiField :label="t('contact.email')" input-id="c-email">
            <UiInput id="c-email" v-model="form.email" type="email" required />
          </UiField>
          <UiField :label="t('contact.subject')" input-id="c-subject">
            <UiInput id="c-subject" v-model="form.subject" />
          </UiField>
          <UiField :label="t('contact.message')" input-id="c-message">
            <UiTextarea id="c-message" v-model="form.message" :rows="5" />
          </UiField>
          <UiButton type="submit" block :loading="sending">{{ t('contact.send') }}</UiButton>
        </form>
      </div>
    </div>
  </div>
</template>
