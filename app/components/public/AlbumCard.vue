<script setup lang="ts">
defineProps<{
  album: {
    slug: string
    title: string
    eventDate: string | null
    photoCount: number
    coverKey: string | null
  }
}>()
</script>

<template>
  <NuxtLink :to="`/galleries/${album.slug}`" class="group block">
    <div class="aspect-[4/3] overflow-hidden rounded-lg bg-paper-soft">
      <img
        v-if="album.coverKey"
        :src="`/images/${album.coverKey}`"
        :alt="album.title"
        class="size-full object-cover"
        loading="lazy"
      >
      <div v-else class="flex size-full items-center justify-center text-ink-soft/30">
        <Icon name="heroicons:photo" class="size-10" />
      </div>
    </div>
    <h3 class="mt-3 whitespace-pre-line font-semibold text-ink group-hover:text-accent" :lang="textLang(album.title)">{{ album.title }}</h3>
    <p class="mt-0.5 text-sm text-ink-soft">
      {{ album.eventDate ? formatDate(album.eventDate) : '' }}
      <span v-if="album.eventDate"> · </span>{{ album.photoCount }} รูป
    </p>
  </NuxtLink>
</template>
