<script setup lang="ts">
interface Post {
  id: number
  slug: string
  title: string
  excerpt: string | null
  coverR2Key: string | null
  tags: string[]
  publishedAt: string | null
  bodyHtml: string
}

const route = useRoute()
const slug = route.params.slug as string

const { data: post, error } = await useFetch<Post>(`/api/posts/${slug}`)
if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'ไม่พบบทความ', fatal: true })
}

const origin = useRequestURL().origin
useSeoMeta({
  title: () => post.value!.title.replace(/\n+/g, ' '),
  description: () => (post.value!.excerpt || post.value!.title).replace(/\n+/g, ' '),
  ogImage: () => (post.value!.coverR2Key ? `${origin}/images/${post.value!.coverR2Key}` : undefined)
})
</script>

<template>
  <article v-if="post" class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <NuxtLink to="/blog" class="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
      <Icon name="heroicons:arrow-left" class="size-4" /> กลับไปบทความ
    </NuxtLink>

    <header class="mt-4">
      <p class="text-sm text-ink-soft">{{ formatDate(post.publishedAt) }}</p>
      <h1 class="mt-2 whitespace-pre-line text-3xl font-bold tracking-tight text-ink sm:text-4xl">{{ post.title }}</h1>
      <div v-if="post.tags?.length" class="mt-3 flex flex-wrap gap-2">
        <UiBadge v-for="t in post.tags" :key="t" tone="pink">{{ t }}</UiBadge>
      </div>
    </header>

    <img
      v-if="post.coverR2Key"
      :src="`/images/${post.coverR2Key}`"
      :alt="post.title"
      class="mt-8 aspect-[16/9] w-full rounded-lg object-cover"
    >

    <!-- bodyHtml is sanitized server-side (renderMarkdown) -->
    <div class="prose prose-zinc mt-8 max-w-none prose-a:text-accent prose-img:rounded-lg" v-html="post.bodyHtml" />
  </article>
</template>
