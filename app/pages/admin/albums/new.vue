<script setup lang="ts">
import type { AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)

async function save(value: AlbumInput) {
  busy.value = true
  try {
    await $fetch('/api/admin/albums', { method: 'POST', body: value })
    await navigateTo(localePath('/admin'))
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed'))
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newAlbum')} — Admin` })
</script>

<template>
  <div>
    <NuxtLink :to="localePath('/admin')" class="back">← {{ t('admin.albums') }}</NuxtLink>
    <h1 class="title">{{ t('admin.newAlbum') }}</h1>
    <AdminAlbumForm :submit-label="t('admin.createAlbum')" :busy="busy" @submit="save" />
  </div>
</template>

<style scoped>
.back { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.title { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 200; margin: 0.75rem 0 2rem; }
</style>
