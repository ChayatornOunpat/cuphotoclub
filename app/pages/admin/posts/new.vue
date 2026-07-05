<script setup lang="ts">
import type { PostInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)
const postTitle = ref('')

async function save(value: PostInput) {
  busy.value = true
  try {
    await $fetch('/api/admin/posts', { method: 'POST', body: value })
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
  <div class="admin-wrap">
    <NuxtLink :to="localePath('/admin/posts')" class="back">{{ t('admin.posts') }}</NuxtLink>
    <h1 class="title">{{ postTitle.trim() || 'Untitled' }}</h1>
    <AdminPostForm :submit-label="t('admin.createPost')" :busy="busy" @submit="save" @update:title="v => postTitle = v" />
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.back { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.title { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 200; margin: 0.75rem 0 2rem; }
</style>
