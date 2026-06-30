<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

async function save(value: AlbumInput) {
  busy.value = true
  saveError.value = null
  try {
    const album = await $fetch('/api/admin/albums', { method: 'POST', body: value })
    saved.value = true
    await navigateTo(localePath(`/albums/${album.id}`))
  } catch (e) {
    saveError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed')
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newAlbum')} — Admin` })
</script>

<template>
  <AdminAlbumForm :submit-label="t('admin.createAlbum')" :busy="busy" :error="saveError" :saved="saved" @submit="save" />
</template>
