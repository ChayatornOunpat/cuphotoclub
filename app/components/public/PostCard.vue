<script setup lang="ts">
import type { Post } from '~~/shared/types'

defineProps<{ post: Post }>()
</script>

<template>
  <NuxtLink :to="`/blog/${post.id}`" class="group flex flex-col">
    <div class="aspect-[16/9] overflow-hidden rounded-lg bg-paper-soft">
      <img
        v-if="post.image"
        :src="post.image"
        :alt="post.title"
        class="size-full object-cover"
        loading="lazy"
      >
      <div v-else class="flex size-full items-center justify-center text-ink-soft/30">
        <Icon name="heroicons:document-text" class="size-9" />
      </div>
    </div>
    <p class="mt-3 text-xs text-ink-soft">{{ formatDate(post.published) }}</p>
    <h3 class="mt-1 whitespace-pre-line font-semibold text-ink group-hover:text-accent">{{ post.title }}</h3>
    <p v-if="post.excerpt" class="mt-1 line-clamp-2 text-sm text-ink-soft">{{ post.excerpt }}</p>
  </NuxtLink>
</template>
