<script setup lang="ts">
import { defaultSite } from '~/utils/defaultSite'

// ── Data layer: albums + blog posts come from the same SQLite-backed APIs used
//    by admin. Sections below are just different views over this data.
const site = ref(defaultSite)
const { data: albums } = await useAsyncData('albums', async () => {
  const adminAlbums = await $fetch('/api/albums').catch(() => [])
  if (adminAlbums.length) return adminAlbums.map(album => ({ ...album, path: `/albums/${album.id}` }))
  return []
})
const { data: posts } = await useAsyncData('posts', async () => {
  const adminPosts = await $fetch('/api/posts').catch(() => [])
  if (adminPosts.length) return adminPosts.map(post => ({ ...post, path: `/posts/${post.id}` }))
  return []
})
const { t } = useI18n()
const localizedPath = useLocalizedContentPath()
const localizedSite = useLocalizedSite(site)

function coverOf(album: NonNullable<typeof albums.value>[number]) {
  return album.coverSrc || (album.rows ?? []).flatMap((r: any) => r.cells).find((c: any) => c.type === 'image' && c.src)?.src || ''
}

// ── Featured Work: FeaturedWork.vue lays out a randomised, rectangle-guaranteed
//    wall from these albums. The randomness is driven by a seed that is created
//    once on the server and serialised via useState, so the server and client
//    renders are identical (no hydration mismatch). A fresh page load → new seed
//    → new layout.
const featuredSeed = useState('featured-seed', () => Math.floor(Math.random() * 2147483647))

const featuredAlbums = computed(() =>
  (albums.value ?? [])
    .map(a => ({
      title: a.title,
      category: a.category,
      cover: coverOf(a),
      path: localizedPath(a.path)
    }))
    .filter(a => a.cover)
)

// ── Stories: albums + posts merged into one feed, newest first.
const feed = computed(() => {
  const albumItems = (albums.value ?? [])
    .map(a => ({
      kind: 'album' as const,
      title: a.title,
      tag: `${t('common.album')} · ${a.category}`,
      date: a.date,
      published: a.published,
      image: coverOf(a),
      excerpt: a.excerpt,
      path: localizedPath(a.path)
    }))
    .filter(a => a.image)
  const postItems = (posts.value ?? [])
    .map(p => ({
      kind: 'post' as const,
      title: p.title,
      tag: p.tag,
      date: p.date,
      published: p.published,
      image: p.image,
      excerpt: p.excerpt,
      path: localizedPath(p.path)
    }))
    .filter(p => p.image)
  return [...albumItems, ...postItems].sort((a, b) => b.published.localeCompare(a.published))
})

const leadStory = computed(() => feed.value[0] ?? null)
const smallStories = computed(() => feed.value.slice(1, 5))

// ── Scroll UI: reading-progress bar + nav dark→light handoff at the hero edge.
const navLight = ref(false)
const progress = ref(0)

function onScroll() {
  const total = document.body.scrollHeight - window.innerHeight
  progress.value = total > 0 ? (window.scrollY / total) * 100 : 0
  navLight.value = window.scrollY > window.innerHeight * 0.9
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))

useHead({
  title: () => `${t('nav.logo')} — Chulalongkorn University`,
  meta: [
    {
      name: 'description',
      content:
        'The official photography club of Chulalongkorn University — documenting life, culture, and the human condition since 1967.'
    }
  ]
})
</script>

<template>
  <div v-if="localizedSite">
    <div id="progress" :style="{ width: progress + '%' }" />

    <SiteNav :links="localizedSite.nav.links" :light="navLight" />

    <SiteHero :hero="localizedSite.hero" />

    <!-- Signature pink line: dark → light transition -->
    <div class="cut-line" />

    <FeaturedWork :albums="featuredAlbums" :seed="featuredSeed" />

    <StoriesSection :lead="leadStory" :items="smallStories" />

    <HistorySection :history="localizedSite.history" />

    <AboutSection :about="localizedSite.about" />

    <SiteFooter :footer="localizedSite.footer" />
  </div>
</template>

<style scoped>
#progress {
  position: fixed;
  top: 0; left: 0;
  z-index: 200;
  height: 2px;
  background: var(--accent);
  transition: width 0.1s linear;
}
</style>
