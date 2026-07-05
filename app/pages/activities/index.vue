<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface EventRow {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: string | null
  location: string | null
}

const { t } = useI18n()
const { data: events } = await useFetch<EventRow[]>('/api/events')

useSeoMeta({
  title: () => t('activities.pageTitle'),
  description: () => t('activities.pageLead')
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink">{{ t('activities.pageTitle') }}</h1>
      <p class="mt-3 text-ink-soft">{{ t('activities.pageLead') }}</p>
    </header>

    <div v-if="events && events.length" class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <PublicEventCard v-for="ev in events" :key="ev.id" :event="ev" />
    </div>

    <div v-else class="mt-16 text-center text-ink-soft">
      <Icon name="heroicons:calendar-days" class="mx-auto size-12 text-ink-soft/30" />
      <p class="mt-4">{{ t('activities.empty') }}</p>
    </div>
  </div>
</template>
