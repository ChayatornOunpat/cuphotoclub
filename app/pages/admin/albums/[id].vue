<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string
const mediaPrefix = `content-albums/${id}`

const { data: album } = await useFetch(`/api/admin/albums/${id}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

async function save(value: AlbumInput) {
  busy.value = true
  saveError.value = null
  try {
    await $fetch(`/api/admin/albums/${id}`, { method: 'PUT', body: value })
    saved.value = true
    await navigateTo(localePath(value.visibility === 'draft' ? `/admin/albums/${id}` : `/albums/${id}`))
  } catch (e) {
    saveError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed')
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `Edit ${album.value?.title} — Admin` })
</script>

<template>
  <AdminAlbumForm v-if="album" :initial="album" :media-prefix="mediaPrefix" :submit-label="t('admin.saveChanges')" :busy="busy" :error="saveError" :saved="saved" @submit="save" />
</template>
