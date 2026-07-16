<script setup lang="ts">
import type { Album, AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const slug = route.params.slug as string

const { data: album } = await useFetch<Album>(`/api/admin/albums/${slug}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

// R2 media lives under the album's immutable id, never its (renamable) slug.
const mediaPrefix = `content-albums/${album.value!.id}`

const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

async function save(value: AlbumInput) {
  busy.value = true
  saveError.value = null
  try {
    // Save by id (immutable) — the slug in the URL may change when the title does.
    await $fetch(`/api/admin/albums/${album.value!.id}`, { method: 'PUT', body: value })
    saved.value = true
    await navigateTo(localePath('/admin/albums'))
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
