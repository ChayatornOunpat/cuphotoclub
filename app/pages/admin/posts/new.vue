<script setup lang="ts">
import type { PostInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)

const draftMediaPrefix = useState('draft-post-media-prefix', () => `content-posts/drafts/${crypto.randomUUID()}`)
const draftMediaStorageKey = 'cu-photo-draft-post-media-prefix'

onMounted(() => {
  const savedPrefix = localStorage.getItem(draftMediaStorageKey)
  if (savedPrefix?.startsWith('content-posts/drafts/')) {
    draftMediaPrefix.value = savedPrefix
  } else {
    localStorage.setItem(draftMediaStorageKey, draftMediaPrefix.value)
  }
})

async function save(value: PostInput) {
  busy.value = true
  try {
    await $fetch('/api/admin/posts', { method: 'POST', body: value })
    localStorage.removeItem(draftMediaStorageKey)
    draftMediaPrefix.value = `content-posts/drafts/${crypto.randomUUID()}`
    await navigateTo(localePath('/admin/posts'))
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed'))
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newPost')} - Admin` })
</script>

<template>
  <AdminPostForm
    :media-prefix="draftMediaPrefix"
    :submit-label="t('admin.createPost')"
    :busy="busy"
    @submit="save"
  />
</template>
