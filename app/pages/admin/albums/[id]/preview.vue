<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const id = route.params.id as string

const { data: album } = await useFetch(`/api/admin/albums/${id}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

const allImages = computed(() =>
  (album.value?.rows ?? []).flatMap(r => r.cells.filter(c => c.type === 'image'))
)
useHead({ title: () => `${album.value?.title} - ${t('admin.preview')}` })
</script>

<template>
  <article v-if="album" class="preview">
    <nav class="preview__nav">
      <NuxtLink :to="localePath('/admin/albums')" class="back">{{ t('admin.albums') }}</NuxtLink>
      <div>
        <NuxtLink :to="localePath(`/admin/albums/${album.id}`)" class="action">{{ t('admin.edit') }}</NuxtLink>
      </div>
    </nav>

    <header class="head">
      <p class="eyeline">{{ t('admin.preview') }} · {{ album.category }}</p>
      <h1>{{ album.title }}</h1>
      <p>{{ album.excerpt }}</p>
    </header>

    <img v-if="album.coverSrc" class="cover" :src="album.coverSrc" :alt="album.title">

    <dl class="facts">
      <div><dt>{{ t('admin.tableDate') }}</dt><dd>{{ album.date }}</dd></div>
      <div><dt>{{ t('admin.tableStyle') }}</dt><dd>{{ album.style }}</dd></div>
      <div><dt>{{ t('admin.tableFrames') }}</dt><dd>{{ allImages.length }}</dd></div>
    </dl>

    <section class="grid">
      <figure v-for="(cell, index) in allImages" :key="index">
        <img :src="cell.src" :alt="cell.caption || `${album.title} ${index + 1}`">
        <figcaption>{{ cell.caption || `${t('common.frame')} ${index + 1}` }}</figcaption>
      </figure>
    </section>
  </article>
</template>

<style scoped>
.preview__nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; }
.back, .action { font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover, .action:hover { color: var(--accent); }
.head { max-width: 760px; margin-bottom: 2rem; }
.eyeline { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; }
.head h1 { font-family: var(--font-serif); font-size: clamp(2.7rem, 6vw, 5rem); line-height: 1; font-weight: 200; margin-bottom: 1rem; }
.head p:last-child { color: var(--muted); line-height: 1.8; }
.cover { width: 100%; max-height: 620px; object-fit: cover; display: block; margin-bottom: 1.5rem; }
.facts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--subtle); margin-bottom: 3rem; }
.facts div { background: var(--body-bg); padding: 1rem; }
.facts dt { font-size: 0.52rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem; }
.facts dd { font-size: 0.9rem; }
.grid { columns: 2 280px; column-gap: 1rem; }
figure { break-inside: avoid; margin-bottom: 1rem; }
figure img { width: 100%; display: block; }
figcaption { color: var(--muted); font-size: 0.72rem; line-height: 1.5; margin-top: 0.45rem; }
@media (max-width: 760px) {
  .facts { grid-template-columns: 1fr 1fr; }
}
</style>
