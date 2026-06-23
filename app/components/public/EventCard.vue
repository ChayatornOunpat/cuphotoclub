<script setup lang="ts">
defineProps<{
  event: {
    slug: string
    title: string
    summary: string | null
    coverR2Key: string | null
    eventDate: string | null
    location: string | null
  }
}>()
</script>

<template>
  <NuxtLink :to="`/activities/${event.slug}`" class="group flex flex-col overflow-hidden rounded-lg border border-line bg-white transition-shadow hover:shadow-sm">
    <div class="aspect-[16/9] overflow-hidden bg-paper-soft">
      <img
        v-if="event.coverR2Key"
        :src="`/images/${event.coverR2Key}`"
        :alt="event.title"
        class="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        loading="lazy"
      >
      <div v-else class="flex size-full items-center justify-center text-ink-soft/30">
        <Icon name="heroicons:calendar-days" class="size-9" />
      </div>
    </div>
    <div class="flex flex-1 flex-col p-4">
      <p class="text-xs font-medium text-accent">
        {{ event.eventDate ? formatDate(event.eventDate) : 'เร็ว ๆ นี้' }}
      </p>
      <h3 class="mt-1 font-semibold text-ink group-hover:text-accent">{{ event.title }}</h3>
      <p v-if="event.location" class="mt-1 flex items-center gap-1 text-sm text-ink-soft">
        <Icon name="heroicons:map-pin" class="size-4" /> {{ event.location }}
      </p>
      <p v-if="event.summary" class="mt-2 line-clamp-2 text-sm text-ink-soft">{{ event.summary }}</p>
    </div>
  </NuxtLink>
</template>
