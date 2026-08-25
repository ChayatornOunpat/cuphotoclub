<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: post } = await useFetch(`/api/admin/posts/${id}`)
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })

useHead({ title: () => `${post.value?.title} - ${t('admin.preview')}` })
</script>

<template>
  <article v-if="post" class="preview">
    <nav class="preview__nav">
      <NuxtLink :to="localePath('/admin/posts')" class="back">{{ t('admin.posts') }}</NuxtLink>
      <NuxtLink :to="localePath(`/admin/posts/${post.id}`)" class="action">{{ t('admin.edit') }}</NuxtLink>
    </nav>

    <PublicPostArticle :post="post" />
  </article>
</template>

<style scoped>
.preview { max-width: 820px; margin: 0 auto; padding: 2rem 0 5rem; overflow: visible; }
.preview__nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
.back, .action { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover, .action:hover { color: var(--accent); }
</style>
