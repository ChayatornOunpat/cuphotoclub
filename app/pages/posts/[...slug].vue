<script setup lang="ts">
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()
const slug = computed(() => {
  const value = route.params.slug
  return Array.isArray(value) ? value.join('/') : String(value)
})

const { data: post } = await useAsyncData(`post-${route.path}`, async () => {
  return await $fetch(`/api/posts/${slug.value}`).catch(() => null)
})
const paragraphs = computed(() => post.value?.body.split(/\n{2,}/).map(p => p.trim()).filter(Boolean) ?? [])

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

useHead({ title: () => `${post.value?.title} — CU Photo Club` })
</script>

<template>
  <article v-if="post" class="post">
    <header class="post__head">
      <NuxtLink :to="localePath('/')" class="post__back">{{ t('posts.backToHome') }}</NuxtLink>
      <p class="post__eyebrow">{{ post.tag }} · {{ post.date }}</p>
      <h1 class="post__title">{{ post.title }}</h1>
    </header>

    <div class="post__hero">
      <AppImg :src="post.image" :alt="post.title" width="1200" height="800" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" eager />
    </div>

    <div class="post__body">
      <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
    </div>
  </article>
</template>

<style scoped>
.post { max-width: 760px; margin: 0 auto; padding: 4rem 3rem 6rem; }

.post__back {
  display: inline-block;
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  margin-bottom: 3rem;
  transition: color 0.2s;
}
.post__back:hover { color: var(--accent); }
.post__eyebrow {
  font-size: 0.56rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.25rem;
}
.post__title {
  font-family: var(--font-serif);
  font-size: clamp(2.2rem, 4.5vw, 3.8rem);
  font-weight: 200;
  line-height: 1.05;
  letter-spacing: -0.025em;
  margin-bottom: 2.5rem;
}
.post__hero { margin-bottom: 3rem; overflow: hidden; }
.post__hero :deep(img) { width: 100%; height: auto; display: block; }

.post__body :deep(p) {
  font-size: 1rem;
  color: var(--dark);
  line-height: 1.95;
  margin-bottom: 1.5rem;
}

@media (max-width: 640px) {
  .post { padding: 3rem 1.5rem 4rem; }
}
</style>
