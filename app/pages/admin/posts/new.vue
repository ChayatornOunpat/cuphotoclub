<script setup lang="ts">
import type { PostInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)

async function save(value: PostInput) {
  busy.value = true
  try {
    const post = await $fetch('/api/admin/posts', { method: 'POST', body: value })
    await navigateTo(localePath(`/posts/${post.id}`))
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed'))
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newPost')} - Admin` })
</script>

<template>
  <div>
    <NuxtLink :to="localePath('/admin/posts')" class="back">{{ t('admin.posts') }}</NuxtLink>
    <h1 class="title">{{ t('admin.newPost') }}</h1>
    <AdminPostForm :submit-label="t('admin.createPost')" :busy="busy" @submit="save" />
  </div>
</template>

<style scoped>
.back { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.title { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 200; margin: 0.75rem 0 2rem; }
</style>
