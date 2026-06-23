<script setup lang="ts">
interface HomeData {
  albums: { id: number, slug: string, title: string, eventDate: string | null, photoCount: number, coverKey: string | null }[]
  posts: { id: number, slug: string, title: string, excerpt: string | null, coverR2Key: string | null, publishedAt: string | null }[]
  events: { id: number, slug: string, title: string, summary: string | null, coverR2Key: string | null, eventDate: string | null, location: string | null }[]
}

const { data } = await useFetch<HomeData>('/api/home')
const { data: settings } = useSiteSettings()

useSeoMeta({
  title: 'หน้าแรก',
  description: () => settings.value?.siteDescription || strings.home.heroSubtitle
})
</script>

<template>
  <div>
    <!-- Hero -->
    <section class="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <p class="text-sm font-medium uppercase tracking-widest text-accent">{{ strings.home.eyebrow }}</p>
      <h1 class="mt-4 max-w-3xl text-4xl font-bold tracking-tight text-ink sm:text-6xl">{{ strings.home.heroTitle }}</h1>
      <p class="mt-6 max-w-xl text-lg text-ink-soft">{{ settings?.siteDescription || strings.home.heroSubtitle }}</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <UiButton to="/galleries" size="lg">{{ strings.home.viewGalleries }}</UiButton>
        <UiButton to="/about" size="lg" variant="secondary">{{ strings.nav.about }}</UiButton>
      </div>
    </section>

    <!-- Featured galleries -->
    <section v-if="data?.albums.length" class="border-t border-line bg-paper-soft">
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="flex items-end justify-between gap-4">
          <h2 class="text-2xl font-bold tracking-tight text-ink">แกลเลอรีล่าสุด</h2>
          <NuxtLink to="/galleries" class="text-sm font-medium text-accent hover:underline">ดูทั้งหมด →</NuxtLink>
        </div>
        <div class="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          <PublicAlbumCard v-for="album in data.albums" :key="album.id" :album="album" />
        </div>
      </div>
    </section>

    <!-- Latest posts -->
    <section v-if="data?.posts.length" class="border-t border-line">
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="flex items-end justify-between gap-4">
          <h2 class="text-2xl font-bold tracking-tight text-ink">บทความล่าสุด</h2>
          <NuxtLink to="/blog" class="text-sm font-medium text-accent hover:underline">ดูทั้งหมด →</NuxtLink>
        </div>
        <div class="mt-8 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          <PublicPostCard v-for="post in data.posts" :key="post.id" :post="post" />
        </div>
      </div>
    </section>

    <!-- Recent events -->
    <section v-if="data?.events.length" class="border-t border-line bg-paper-soft">
      <div class="mx-auto max-w-6xl px-4 py-16">
        <div class="flex items-end justify-between gap-4">
          <h2 class="text-2xl font-bold tracking-tight text-ink">กิจกรรม</h2>
          <NuxtLink to="/activities" class="text-sm font-medium text-accent hover:underline">ดูทั้งหมด →</NuxtLink>
        </div>
        <div class="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <PublicEventCard v-for="ev in data.events" :key="ev.id" :event="ev" />
        </div>
      </div>
    </section>

    <!-- Contact CTA -->
    <section class="border-t border-line">
      <div class="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-16 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 class="text-2xl font-bold tracking-tight text-ink">อยากร่วมกิจกรรมกับเรา?</h2>
          <p class="mt-2 text-ink-soft">ติดต่อชมรมเพื่อสอบถามหรือเข้าร่วมเป็นสมาชิก</p>
        </div>
        <UiButton to="/contact" size="lg">{{ strings.nav.contact }}</UiButton>
      </div>
    </section>
  </div>
</template>
