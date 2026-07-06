<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useHead({ title: () => t('adminAbout.title') })

const { data: page, refresh } = await useFetch<{ title: string, body: string }>('/api/admin/pages/about')

const form = reactive({ title: '', body: '' })
watchEffect(() => {
  if (page.value) Object.assign(form, { title: page.value.title, body: page.value.body })
})

const saving = ref(false)
const savedMsg = ref('')
async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch('/api/admin/pages/about', { method: 'PUT', body: { title: form.title, body: form.body } })
    savedMsg.value = t('admin.saved')
    await refresh()
  } catch (e) {
    savedMsg.value = (e as { data?: { message?: string } })?.data?.message || t('admin.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">{{ t('adminAbout.heading') }}</h1>
        <p class="mt-1 text-sm text-ink-soft">{{ t('adminAbout.lead') }}</p>
      </div>
      <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
    </div>

    <div class="mt-6 space-y-4 rounded-lg border border-line bg-white p-5">
      <UiField :label="t('adminAbout.fieldTitle')" input-id="ab-title">
        <UiInput id="ab-title" v-model="form.title" />
      </UiField>
      <UiField :label="t('adminAbout.fieldBody')" input-id="ab-body">
        <UiTextarea id="ab-body" v-model="form.body" :rows="20" class="font-mono" />
      </UiField>
      <div class="flex items-center gap-3">
        <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
        <span v-if="savedMsg" class="text-sm text-ink-soft">{{ savedMsg }}</span>
      </div>
    </div>
  </div>
</template>
