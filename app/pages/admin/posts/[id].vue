<script setup lang="ts">
import type { PostInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: post } = await useFetch(`/api/admin/posts/${id}`)
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
const mediaPrefix = `content-posts/${id}`

const busy = ref(false)

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
  <AdminPostForm
    v-if="post"
    :initial="post"
    :media-prefix="mediaPrefix"
    :submit-label="t('admin.saveChanges')"
    :busy="busy"
    @submit="save"
  />
</template>
