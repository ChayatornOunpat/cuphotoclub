<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: post } = await useFetch(`/api/admin/posts/${id}`)
if (!post.value) throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })

const paragraphs = computed(() => post.value?.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean) ?? [])
useHead({ title: () => `${post.value?.title} - ${t('admin.preview')}` })
</script>

<template>
  <article v-if="post" class="post-preview">
    <nav class="preview__nav">
      <NuxtLink :to="localePath('/admin/posts')" class="back">{{ t('admin.posts') }}</NuxtLink>
      <NuxtLink :to="localePath(`/admin/posts/${post.id}`)" class="action">{{ t('admin.edit') }}</NuxtLink>
    </nav>

    <header class="post-preview__head">
      <p class="eyeline">{{ t('admin.preview') }} · {{ post.tag }} · {{ post.date }}</p>
      <h1>{{ post.title }}</h1>
      <p>{{ post.excerpt }}</p>
    </header>

    <img class="hero" :src="post.image" :alt="post.title">

    <div class="body">
      <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
    </div>
  </article>
</template>

<style scoped>
.post-preview { max-width: 820px; margin: 0 auto; }
.preview__nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
.back, .action { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover, .action:hover { color: var(--accent); }
.post-preview__head { margin-bottom: 2rem; }
.eyeline { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; }
.post-preview__head h1 { font-family: var(--font-serif); font-size: clamp(2.5rem, 5.4vw, 4.6rem); line-height: 1.05; font-weight: 200; margin-bottom: 1rem; }
.post-preview__head p:last-child { color: var(--muted); line-height: 1.8; }
.hero { width: 100%; max-height: 560px; object-fit: cover; display: block; margin-bottom: 2.5rem; }
.body p { font-size: 1rem; line-height: 1.95; margin-bottom: 1.4rem; }
</style>
