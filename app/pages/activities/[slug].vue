<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface EventItem {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: string | null
  endDate: string | null
  location: string | null
  registerUrl: string | null
  publishedAt: string | null
  bodyHtml: string
}

const { t } = useI18n()
const route = useRoute()
const slug = route.params.slug as string

const { data: ev, error } = await useFetch<EventItem>(`/api/events/${slug}`)
if (error.value || !ev.value) {
  throw createError({ statusCode: 404, statusMessage: t('activities.notFound'), fatal: true })
}

const origin = useRequestURL().origin
useSeoMeta({
  title: () => ev.value!.title,
  description: () => ev.value!.summary || ev.value!.title,
  ogImage: () => (ev.value!.coverR2Key ? `${origin}/images/${ev.value!.coverR2Key}` : undefined)
})
</script>

<template>
  <article v-if="ev" class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <NuxtLink to="/activities" class="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
      <Icon name="heroicons:arrow-left" class="size-4" /> {{ t('activities.backToList') }}
    </NuxtLink>

    <header class="mt-4">
      <h1 class="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{{ ev.title }}</h1>
      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft">
        <span v-if="ev.eventDate" class="inline-flex items-center gap-1">
          <Icon name="heroicons:calendar-days" class="size-4" />
          {{ formatDate(ev.eventDate) }}<template v-if="ev.endDate && ev.endDate !== ev.eventDate"> – {{ formatDate(ev.endDate) }}</template>
        </span>
        <span v-if="ev.location" class="inline-flex items-center gap-1">
          <Icon name="heroicons:map-pin" class="size-4" /> {{ ev.location }}
        </span>
      </div>
    </header>

    <img
      v-if="ev.coverR2Key"
      :src="`/images/${ev.coverR2Key}`"
      :alt="ev.title"
      class="mt-8 aspect-[16/9] w-full rounded-lg object-cover"
    >

    <p v-if="ev.summary" class="mt-8 text-lg text-ink-soft">{{ ev.summary }}</p>

    <div class="prose prose-zinc mt-6 max-w-none prose-a:text-accent prose-img:rounded-lg" v-html="ev.bodyHtml" />

    <div v-if="ev.registerUrl" class="mt-10 rounded-lg border border-line bg-paper-soft p-6 text-center">
      <p class="text-sm text-ink-soft">{{ t('activities.interested') }}</p>
      <div class="mt-3">
        <UiButton :to="ev.registerUrl" size="lg" target="_blank" rel="noopener">
          {{ t('activities.register') }} <Icon name="heroicons:arrow-top-right-on-square" class="size-4" />
        </UiButton>
      </div>
    </div>
  </article>
</template>
