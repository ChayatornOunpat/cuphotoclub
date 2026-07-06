<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)
const draftMediaPrefix = useState('draft-album-media-prefix', () => `content-albums/drafts/${crypto.randomUUID()}`)
const draftMediaStorageKey = 'cu-photo-draft-album-media-prefix'

onMounted(() => {
  const savedPrefix = localStorage.getItem(draftMediaStorageKey)
  if (savedPrefix?.startsWith('content-albums/drafts/')) {
    draftMediaPrefix.value = savedPrefix
  } else {
    localStorage.setItem(draftMediaStorageKey, draftMediaPrefix.value)
  }
})

async function save(value: AlbumInput) {
  busy.value = true
  saveError.value = null
  try {
    await $fetch('/api/admin/albums', {
      method: 'POST',
      body: { ...value, draftMediaPrefix: draftMediaPrefix.value }
    })
    saved.value = true
    localStorage.removeItem(draftMediaStorageKey)
    draftMediaPrefix.value = `content-albums/drafts/${crypto.randomUUID()}`
    await navigateTo(localePath('/admin/albums'))
  } catch (e) {
    saveError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed')
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newAlbum')} — Admin` })
</script>

<template>
  <AdminAlbumForm :media-prefix="draftMediaPrefix" :submit-label="t('admin.createAlbum')" :busy="busy" :error="saveError" :saved="saved" @submit="save" />
</template>
