<script setup lang="ts">
import AlbumEssay from '~/components/AlbumEssay.vue'
import AlbumSticky from '~/components/AlbumSticky.vue'
import AlbumContact from '~/components/AlbumContact.vue'
import AlbumDarkroom from '~/components/AlbumDarkroom.vue'
import AlbumChapters from '~/components/AlbumChapters.vue'

definePageMeta({ layout: 'site' })

const route = useRoute()
const slug = computed(() => {
  const value = route.params.slug
  return decodePathSegment(Array.isArray(value) ? value.join('/') : String(value))
})

const { data: album } = await useAsyncData(`album-${slug.value}`, async () => {
  return await $fetch(`/api/albums/${slug.value}`).catch(() => null)
})

if (!album.value) {
  throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })
}

// The admin's chosen style maps to a render component (set-and-forget). Explicit
// imports (not a string name) so the components are bundled and resolve for <component :is>.
const styles = { essay: AlbumEssay, sticky: AlbumSticky, contact: AlbumContact, darkroom: AlbumDarkroom, chapters: AlbumChapters }
const styleComponent = computed(() => styles[album.value!.style] ?? AlbumEssay)

// Social link previews: without og:description/og:image scrapers fall back to
// scraping the nav text and the favicon. Image URLs must be absolute.
const origin = useRequestURL().origin
const coverUrl = computed(() => {
  const src = album.value?.coverSrc
    || album.value?.rows?.flatMap(r => r.cells).find(c => c.type === 'image' && c.src)?.src
  if (!src) return undefined
  return /^https?:\/\//i.test(src) ? src : `${origin}${src.startsWith('/') ? '' : '/images/'}${src}`
})

// app.vue's titleTemplate appends "· CU Photo Club" — don't add a suffix here.
useSeoMeta({
  title: () => album.value?.title?.replace(/\n+/g, ' '),
  ogTitle: () => album.value?.title?.replace(/\n+/g, ' '),
  description: () => album.value?.excerpt || album.value?.title?.replace(/\n+/g, ' '),
  ogDescription: () => album.value?.excerpt || album.value?.title?.replace(/\n+/g, ' '),
  ogImage: () => coverUrl.value,
  ogType: 'article',
  twitterCard: () => (coverUrl.value ? 'summary_large_image' : 'summary')
})

// ImageGallery structured data. Album cell images are resolved to absolute URLs
// so they're valid in the ImageObject list.
const galleryImages = computed(() => {
  const src = (raw?: string) => {
    if (!raw) return undefined
    return /^https?:\/\//i.test(raw) ? raw : `${origin}${raw.startsWith('/') ? '' : '/images/'}${raw}`
  }
  return (album.value?.rows ?? [])
    .flatMap(r => r.cells)
    .filter(c => c.type === 'image' && c.src)
    .map(c => src(c.src))
    .filter((u): u is string => Boolean(u))
})

useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ImageGallery',
        name: album.value?.title?.replace(/\n+/g, ' '),
        description: album.value?.excerpt || undefined,
        url: `${origin}${albumRoutePath(album.value?.slug ?? '')}`,
        image: galleryImages.value.length ? galleryImages.value : (coverUrl.value ? [coverUrl.value] : undefined),
        isPartOf: { '@type': 'Organization', name: 'CU Photo Club', url: origin }
      })
    }
  ]
}))
</script>

<template>
  <component :is="styleComponent" v-if="album" :album="album" />
</template>
