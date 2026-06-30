<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

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

    <header class="preview__head">
      <p class="eyeline">{{ t('admin.preview') }} · {{ post.tag }} · {{ post.date }}</p>
      <h1>{{ post.title }}</h1>
      <p v-if="post.excerpt" class="excerpt">{{ post.excerpt }}</p>
    </header>

    <img v-if="post.image" class="hero" :src="post.image" :alt="post.title">

    <div class="body">
      <template v-for="block in post.blocks" :key="block.id">

        <p v-if="block.type === 'text'" class="pb-text">{{ (block as any).content }}</p>
        <p v-else-if="block.type === 'lead'" class="pb-lead">{{ (block as any).content }}</p>
        <h2 v-else-if="block.type === 'heading'" class="pb-heading">{{ (block as any).content }}</h2>
        <h3 v-else-if="block.type === 'subheading'" class="pb-subheading">{{ (block as any).content }}</h3>
        <div v-else-if="block.type === 'pullquote'" class="pb-pullquote">{{ (block as any).content }}</div>

        <blockquote v-else-if="block.type === 'blockquote'" class="pb-blockquote">
          <span>{{ (block as any).content }}</span>
          <cite v-if="(block as any).cite">{{ (block as any).cite }}</cite>
        </blockquote>

        <figure v-else-if="block.type === 'image'" class="pb-image" :class="{ 'pb-image--breakout': (block as any).breakout }">
          <img :src="(block as any).src" :alt="(block as any).caption || ''">
          <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
        </figure>

        <figure v-else-if="block.type === 'photo-full'" class="pb-photo-full">
          <img :src="(block as any).src" :alt="(block as any).caption || ''">
          <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
        </figure>

        <figure v-else-if="block.type === 'photo-pair'" class="pb-photo-pair">
          <img :src="(block as any).src1" alt="">
          <img :src="(block as any).src2" alt="">
          <figcaption v-if="(block as any).caption" class="pb-photo-pair__cap">{{ (block as any).caption }}</figcaption>
        </figure>

        <div v-else-if="block.type === 'divider'" class="pb-divider">· · ·</div>
        <div v-else-if="block.type === 'inset'" class="pb-inset">{{ (block as any).content }}</div>

        <div v-else-if="block.type === 'qanda'" class="pb-qanda">
          <div class="pb-qanda__q">{{ (block as any).question }}</div>
          <div class="pb-qanda__a">{{ (block as any).answer }}</div>
        </div>

      </template>
    </div>
  </article>
</template>

<style scoped>
.preview { max-width: 820px; margin: 0 auto; padding: 2rem 0 5rem; overflow: visible; }
.preview__nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
.back, .action { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover, .action:hover { color: var(--accent); }
.preview__head { margin-bottom: 2rem; }
.eyeline { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; }
.preview__head h1 { font-family: var(--font-serif); font-size: clamp(2rem, 4.5vw, 3.8rem); line-height: 1.05; font-weight: 200; margin-bottom: 1rem; }
.excerpt { color: var(--muted); line-height: 1.8; font-size: 0.9rem; margin-bottom: 1.5rem; }
.hero { width: 100%; max-height: 560px; object-fit: cover; display: block; margin-bottom: 2.5rem; }
.body { display: flex; flex-direction: column; }

.pb-text       { font-size: 1rem; line-height: 1.95; color: var(--dark); margin-bottom: 1.5rem; }
.pb-lead       { font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; line-height: 1.7; margin-bottom: 2rem; padding-left: 1.5rem; border-left: 2px solid var(--accent); }
.pb-heading    { font-family: var(--font-serif); font-size: 1.7rem; font-weight: 300; line-height: 1.15; letter-spacing: -0.02em; margin: 3rem 0 1rem; }
.pb-subheading { font-family: var(--font-serif); font-size: 1.25rem; font-weight: 400; margin: 2rem 0 0.75rem; }
.pb-pullquote  { font-family: var(--font-serif); font-size: 1.7rem; font-weight: 200; font-style: italic; line-height: 1.25; color: var(--accent); margin: 2.5rem 0; padding-left: 2.5rem; border-left: 2px solid var(--accent); }
.pb-blockquote { font-family: var(--font-serif); font-size: 1.2rem; font-weight: 200; font-style: italic; line-height: 1.45; margin: 2rem 0; padding: 1.25rem 1.75rem; border-left: 2px solid var(--accent); background: var(--paper); display: flex; flex-direction: column; gap: 0.6rem; }
.pb-blockquote cite { font-size: 0.68rem; font-style: normal; letter-spacing: 0.1em; color: var(--muted); }
.pb-image      { margin: 2.5rem 0; }
.pb-image--breakout { margin: 2.5rem -3rem; }
.pb-image img  { width: 100%; display: block; }
.pb-image figcaption { font-size: 0.6rem; color: var(--muted); padding: 0.65rem 0 0; text-align: right; letter-spacing: 0.08em; }
.pb-photo-full { margin: 4rem -3rem; }
.pb-photo-full img { width: 100%; max-height: 70vh; object-fit: cover; display: block; }
.pb-photo-full figcaption { font-size: 0.58rem; color: var(--muted); padding: 0.65rem 0 0; text-align: right; letter-spacing: 0.08em; }
.pb-photo-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 4rem -3rem; }
.pb-photo-pair img { width: 100%; height: 50vh; object-fit: cover; display: block; }
.pb-photo-pair__cap { grid-column: 1 / -1; font-size: 0.58rem; color: var(--muted); padding-top: 0.5rem; text-align: right; letter-spacing: 0.08em; }
.pb-divider    { text-align: center; font-size: 0.8rem; color: var(--muted); margin: 2.5rem 0; letter-spacing: 0.5em; }
.pb-inset      { font-size: 0.85rem; line-height: 1.8; color: var(--muted); background: var(--paper); padding: 1.25rem 1.75rem; margin: 1.75rem 0; border-left: 2px solid var(--accent); }
.pb-qanda      { margin-bottom: 2rem; }
.pb-qanda__q   { font-family: var(--font-serif); font-size: 1rem; font-weight: 500; line-height: 1.3; margin-bottom: 0.85rem; display: flex; align-items: flex-start; gap: 0.85rem; }
.pb-qanda__q::before { content: 'Q'; flex-shrink: 0; font-family: var(--font-sans); font-size: 0.56rem; font-weight: 500; color: var(--accent); background: var(--paper); width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--subtle); margin-top: 0.05rem; }
.pb-qanda__a   { font-size: 0.88rem; line-height: 1.8; color: var(--dark); display: flex; align-items: flex-start; gap: 0.85rem; }
.pb-qanda__a::before { content: 'A'; flex-shrink: 0; font-family: var(--font-sans); font-size: 0.56rem; font-weight: 500; background: var(--dark); color: #F5F4F0; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; margin-top: 0.05rem; }

@media (max-width: 640px) {
  .pb-image--breakout, .pb-photo-full, .pb-photo-pair { margin-left: 0; margin-right: 0; }
  .pb-photo-pair { grid-template-columns: 1fr; }
}
</style>
