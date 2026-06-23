<script setup lang="ts">
interface SearchResult {
  query: string
  albums: { slug: string, title: string, eventDate: string | null }[]
  posts: { slug: string, title: string, excerpt: string | null }[]
  events: { slug: string, title: string, summary: string | null, eventDate: string | null }[]
}

const route = useRoute()
const q = ref(String(route.query.q || ''))

const { data, refresh } = await useFetch<SearchResult>('/api/search', {
  query: { q },
  default: () => ({ query: '', albums: [], posts: [], events: [] })
})

function submit() {
  navigateTo({ path: '/search', query: q.value.trim() ? { q: q.value.trim() } : {} })
}

const total = computed(() => (data.value ? data.value.albums.length + data.value.posts.length + data.value.events.length : 0))

useSeoMeta({ title: 'ค้นหา', robots: 'noindex' })
watch(() => route.query.q, () => { q.value = String(route.query.q || ''); refresh() })
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <h1 class="text-2xl font-bold tracking-tight text-ink">ค้นหา</h1>

    <form class="mt-6 flex gap-2" @submit.prevent="submit">
      <div class="relative flex-1">
        <Icon name="heroicons:magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-ink-soft" />
        <input
          v-model="q"
          type="search"
          placeholder="ค้นหาอัลบั้ม บทความ หรือกิจกรรม…"
          class="block w-full rounded-md bg-white py-2 pl-10 pr-3 text-sm text-ink outline-1 -outline-offset-1 outline-line focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
        >
      </div>
      <UiButton type="submit">ค้นหา</UiButton>
    </form>

    <div v-if="route.query.q" class="mt-10 space-y-10">
      <p v-if="total === 0" class="text-ink-soft">ไม่พบผลลัพธ์สำหรับ “{{ route.query.q }}”</p>

      <section v-if="data?.albums.length">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">แกลเลอรี</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="a in data.albums" :key="a.slug">
            <NuxtLink :to="`/galleries/${a.slug}`" class="flex items-center justify-between gap-4 py-3 hover:text-accent">
              <span class="font-medium text-ink">{{ a.title }}</span>
              <span class="text-sm text-ink-soft">{{ a.eventDate ? formatDate(a.eventDate) : '' }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <section v-if="data?.posts.length">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">บทความ</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="p in data.posts" :key="p.slug" class="py-3">
            <NuxtLink :to="`/blog/${p.slug}`" class="font-medium text-ink hover:text-accent">{{ p.title }}</NuxtLink>
            <p v-if="p.excerpt" class="mt-0.5 line-clamp-1 text-sm text-ink-soft">{{ p.excerpt }}</p>
          </li>
        </ul>
      </section>

      <section v-if="data?.events.length">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-ink-soft">กิจกรรม</h2>
        <ul class="mt-3 divide-y divide-line">
          <li v-for="e in data.events" :key="e.slug" class="py-3">
            <NuxtLink :to="`/activities/${e.slug}`" class="font-medium text-ink hover:text-accent">{{ e.title }}</NuxtLink>
            <p v-if="e.summary" class="mt-0.5 line-clamp-1 text-sm text-ink-soft">{{ e.summary }}</p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
