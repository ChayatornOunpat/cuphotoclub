<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: album } = await useFetch(`/api/admin/albums/${id}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

const busy = ref(false)

async function save(value: AlbumInput) {
  busy.value = true
  try {
    await $fetch(`/api/admin/albums/${id}`, { method: 'PUT', body: value })
    await navigateTo(localePath('/admin'))
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed'))
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `Edit ${album.value?.title} — Admin` })
</script>

<template>
  <div v-if="album">
    <NuxtLink :to="localePath('/admin')" class="back">← {{ t('admin.albums') }}</NuxtLink>
    <h1 class="title">{{ t('admin.editAlbum') }}</h1>
    <AdminAlbumForm :initial="album" :submit-label="t('admin.saveChanges')" :busy="busy" @submit="save" />
  </div>
</template>

<style scoped>
.back { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.title { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 200; margin: 0.75rem 0 2rem; }
</style>
