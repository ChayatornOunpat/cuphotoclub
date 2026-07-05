<script setup lang="ts">
import type { PostInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: post } = await useFetch(`/api/admin/posts/${id}`)
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })

const busy = ref(false)
const postTitle = ref(post.value?.title ?? '')

function actorName(actor?: { name?: string | null, email?: string } | null) {
  return actor?.name || actor?.email || 'Unknown'
}

async function save(value: PostInput) {
  busy.value = true
  try {
    await $fetch(`/api/admin/posts/${id}`, { method: 'PUT', body: value })
    await navigateTo(localePath('/admin/posts'))
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed'))
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `Edit ${post.value?.title} - Admin` })
</script>

<template>
  <div v-if="post" class="admin-wrap">
    <NuxtLink :to="localePath('/admin/posts')" class="back">{{ t('admin.posts') }}</NuxtLink>
    <h1 class="title">{{ postTitle.trim() || 'Untitled' }}</h1>
    <p class="meta">
      Created by {{ actorName(post.createdBy) }} · Last edited by {{ actorName(post.updatedBy) }}
    </p>
    <AdminPostForm :initial="post" :submit-label="t('admin.saveChanges')" :busy="busy" @submit="save" @update:title="v => postTitle = v" />
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.back { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.title { font-family: var(--font-serif); font-size: 2.25rem; font-weight: 200; margin: 0.75rem 0 2rem; }
.meta { color: var(--muted); font-size: 0.62rem; letter-spacing: 0.12em; text-transform: uppercase; margin: -1.35rem 0 2rem; }
</style>
