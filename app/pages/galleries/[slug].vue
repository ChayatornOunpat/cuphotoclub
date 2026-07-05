<script setup lang="ts">
interface Photo {
  id: number
  r2Key: string
  width: number | null
  height: number | null
  caption: string | null
  alt: string | null
  photographer: string | null
}
interface Album {
  id: number
  slug: string
  title: string
  description: string | null
  eventDate: string | null
}

const route = useRoute()
const slug = route.params.slug as string

const { data, error } = await useFetch<{ album: Album, photos: Photo[] }>(`/api/albums/${slug}`)
if (error.value || !data.value) {
  throw createError({ statusCode: 404, statusMessage: 'ไม่พบอัลบั้ม', fatal: true })
}

const album = computed(() => data.value!.album)
const photos = computed(() => data.value!.photos)

const lightboxIndex = ref<number | null>(null)

const origin = useRequestURL().origin
useSeoMeta({
  title: () => album.value.title.replace(/\n+/g, ' '),
  description: () => (album.value.description || `ภาพถ่ายจาก ${album.value.title}`).replace(/\n+/g, ' '),
  ogImage: () => (photos.value[0] ? `${origin}/images/${photos.value[0].r2Key}` : undefined)
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <NuxtLink to="/galleries" class="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
      <Icon name="heroicons:arrow-left" class="size-4" /> กลับไปแกลเลอรี
    </NuxtLink>

    <header class="mt-4 max-w-2xl">
      <h1 class="whitespace-pre-line text-3xl font-bold tracking-tight text-ink" :lang="textLang(album.title)">{{ album.title }}</h1>
      <p class="mt-2 text-sm text-ink-soft">
        {{ album.eventDate ? formatDate(album.eventDate) : '' }}
        <span v-if="album.eventDate"> · </span>{{ photos.length }} รูป
      </p>
      <p v-if="album.description" class="mt-3 text-ink-soft" :lang="textLang(album.description)">{{ album.description }}</p>
    </header>

    <div v-if="photos.length" class="mt-10 columns-2 gap-3 sm:columns-3 lg:columns-4">
      <button
        v-for="(p, i) in photos"
        :key="p.id"
        type="button"
        class="mb-3 block w-full break-inside-avoid overflow-hidden rounded-md focus:outline-2 focus:outline-offset-2 focus:outline-accent"
        @click="lightboxIndex = i"
      >
        <img
          :src="`/images/${p.r2Key}`"
          :alt="p.alt || p.caption || album.title"
          :width="p.width || undefined"
          :height="p.height || undefined"
          loading="lazy"
          class="w-full bg-paper-soft transition hover:opacity-90"
        >
      </button>
    </div>

    <p v-else class="mt-16 text-center text-ink-soft">ยังไม่มีรูปภาพในอัลบั้มนี้</p>

    <PublicLightbox v-model:index="lightboxIndex" :photos="photos" />
  </div>
</template>
