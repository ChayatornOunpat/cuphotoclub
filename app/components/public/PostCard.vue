<script setup lang="ts">
import type { Post } from '~~/shared/types'

defineProps<{ post: Post }>()
</script>

<template>
  <NuxtLink :to="`/blog/${post.id}`" class="post-card">
    <div class="post-card__media">
      <img v-if="post.image" :src="post.image" :alt="post.title" loading="lazy">
      <div v-else class="post-card__placeholder">
        <Icon name="heroicons:document-text" />
      </div>
    </div>
    <p class="post-card__meta">{{ formatDate(post.published) }}</p>
    <h3 class="post-card__title">{{ post.title }}</h3>
    <p v-if="post.excerpt" class="post-card__summary">{{ post.excerpt }}</p>
  </NuxtLink>
</template>

<style scoped>
.post-card {
  display: block;
  text-decoration: none;
  transition: opacity 0.2s;
}
.post-card:hover { opacity: 0.85; }

.post-card__media {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: var(--paper);
  margin-bottom: 0.9rem;
}
.post-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.post-card:hover .post-card__media img { transform: scale(1.03); }

.post-card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--subtle);
}
.post-card__placeholder :deep(svg) {
  width: 2rem;
  height: 2rem;
}

.post-card__meta {
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.post-card__title {
  margin-top: 0.4rem;
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--dark);
  white-space: pre-line;
  transition: color 0.15s;
}
.post-card:hover .post-card__title { color: var(--accent); }

.post-card__summary {
  margin-top: 0.4rem;
  font-size: 0.76rem;
  line-height: 1.65;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
