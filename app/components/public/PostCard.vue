<script setup lang="ts">
defineProps<{
  post: {
    slug: string
    title: string
    excerpt: string | null
    coverR2Key: string | null
    publishedAt: string | null
  }
}>()
</script>

<template>
  <NuxtLink :to="`/blog/${post.slug}`" class="group flex flex-col">
    <div class="aspect-[16/9] overflow-hidden rounded-lg bg-paper-soft">
      <img
        v-if="post.coverR2Key"
        :src="`/images/${post.coverR2Key}`"
        :alt="post.title"
        class="size-full object-cover"
        loading="lazy"
      >
      <div v-else class="flex size-full items-center justify-center text-ink-soft/30">
        <Icon name="heroicons:document-text" class="size-9" />
      </div>
    </div>
    <p class="mt-3 text-xs text-ink-soft">{{ formatDate(post.publishedAt) }}</p>
    <h3 class="mt-1 whitespace-pre-line font-semibold text-ink group-hover:text-accent">{{ post.title }}</h3>
    <p v-if="post.excerpt" class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ post.excerpt }}</p>
  </NuxtLink>
</template>
