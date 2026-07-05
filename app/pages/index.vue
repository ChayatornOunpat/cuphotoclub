<script setup lang="ts">
import { defaultSite } from '~/utils/defaultSite'

definePageMeta({ layout: 'site' })

const site = ref(defaultSite)
const { t } = useI18n()
const localizedPath = useLocalizedContentPath()
const localizedSite = useLocalizedSite(site)

const { data: home } = await useAsyncData('home', () =>
  $fetch('/api/home').catch(() => ({ albums: [], posts: [], events: [] }))
)

function imageSrc(key: string | null | undefined) {
  if (!key) return ''
  return /^https?:\/\//.test(key) ? key : `/images/${key}`
}

// contentAlbums (canvas editor) live under /albums/:slug; schema.albums galleries under /galleries/:slug.
function albumPath(a: { slug: string, source?: string }) {
  return a.source === 'content' ? `/albums/${a.slug}` : `/galleries/${a.slug}`
}

// ── Hero background: randomise from the admin-managed image pool.
//    useState pins the seed on the server so client hydration matches.
const { data: heroImagesData } = await useAsyncData('hero-images', () =>
  $fetch<{ images: string[] }>('/api/hero-images').catch(() => ({ images: [] }))
)
const heroImageSeed = useState('hero-image-seed', () => Math.floor(Math.random() * 2147483647))
const heroWithImage = computed(() => {
  const base = localizedSite.value?.hero
  if (!base) return base
  const imgs = heroImagesData.value?.images ?? []
  if (!imgs.length) return base
  return { ...base, image: `/images/${imgs[heroImageSeed.value % imgs.length]}` }
})

// ── Featured Work: FeaturedWork.vue lays out a randomised, rectangle-guaranteed
//    wall from these albums. The randomness is driven by a seed that is created
//    once on the server and serialised via useState, so the server and client
//    renders are identical (no hydration mismatch). A fresh page load → new seed
//    → new layout.
const featuredSeed = useState('featured-seed', () => Math.floor(Math.random() * 2147483647))

const featuredAlbums = computed(() =>
  (home.value?.albums ?? [])
    .map(a => ({
      title: a.title,
      category: t('common.album'),
      cover: imageSrc(a.coverKey),
      path: localizedPath(albumPath(a))
    }))
    .filter(a => a.cover)
)

// ── Stories: albums, posts, and events merged into one feed, newest first.
const feed = computed(() => {
  const albumItems = (home.value?.albums ?? [])
    .map(a => ({
      kind: 'album' as const,
      title: a.title,
      tag: t('common.album'),
      date: a.eventDate ?? '',
      published: a.eventDate ?? '',
      image: imageSrc(a.coverKey),
      excerpt: t('albums.metaFrames', { count: a.photoCount }),
      path: localizedPath(albumPath(a))
    }))
    .filter(a => a.image)
  const postItems = (home.value?.posts ?? [])
    .map(p => ({
      kind: 'post' as const,
      title: p.title,
      tag: t('admin.posts'),
      date: p.publishedAt ?? '',
      published: p.publishedAt ?? '',
      image: imageSrc(p.coverR2Key),
      excerpt: p.excerpt ?? '',
      path: localizedPath(`/blog/${p.slug}`)
    }))
    .filter(p => p.image)
  const eventItems = (home.value?.events ?? [])
    .map(event => ({
      kind: 'event' as const,
      title: event.title,
      tag: event.location ? `${t('nav.activities')} · ${event.location}` : t('nav.activities'),
      date: event.eventDate ?? '',
      published: event.eventDate ?? '',
      image: imageSrc(event.coverR2Key),
      excerpt: event.summary ?? '',
      path: localizedPath(`/activities/${event.slug}`)
    }))
    .filter(event => event.image)

  return [...albumItems, ...postItems, ...eventItems].sort((a, b) => b.published.localeCompare(a.published))
})

const leadStory = computed(() => feed.value[0] ?? null)
const smallStories = computed(() => feed.value.slice(1, 5))

// ── Scroll UI: reading-progress bar + nav dark→light handoff at the hero edge.
const navLight = ref(false)
const progress = ref(0)
const constructionNoticeOpen = ref(false)
const constructionNoticeKey = 'cu-photo-construction-notice-dismissed'

function onScroll() {
  const total = document.body.scrollHeight - window.innerHeight
  progress.value = total > 0 ? (window.scrollY / total) * 100 : 0
  navLight.value = window.scrollY > window.innerHeight * 0.9
}

function dismissConstructionNotice() {
  constructionNoticeOpen.value = false
  if (import.meta.client) sessionStorage.setItem(constructionNoticeKey, '1')
}

onMounted(() => {
  onScroll()
  constructionNoticeOpen.value = sessionStorage.getItem(constructionNoticeKey) !== '1'
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

    <SiteHero :hero="heroWithImage ?? localizedSite.hero" />

    <!-- Signature pink line: dark → light transition -->
    <div class="cut-line" />

    <FeaturedWork :albums="featuredAlbums" :seed="featuredSeed" />

    <StoriesSection :lead="leadStory" :items="smallStories" />

    <HistorySection :history="localizedSite.history" />

    <AboutSection :about="localizedSite.about" />

    <Teleport to="body">
      <div
        v-if="constructionNoticeOpen"
        class="construction-notice"
        role="dialog"
        aria-modal="true"
        aria-labelledby="construction-title"
      >
        <div class="construction-notice__backdrop" @click="dismissConstructionNotice" />
        <section class="construction-notice__panel">
          <p class="construction-notice__kicker">CU PHOTOCLUB / NOTICE</p>
          <h2 id="construction-title">เว็บไซต์อยู่ระหว่างปรับปรุง</h2>
          <p>
            บางหน้าและข้อมูลอาจยังไม่สมบูรณ์ ขอบคุณที่แวะมาชมงานของชมรมระหว่างที่เราจัดวางเว็บไซต์ใหม่
          </p>
          <button type="button" class="construction-notice__button" @click="dismissConstructionNotice">
            เข้าชมเว็บไซต์ต่อ
          </button>
        </section>
      </div>
    </Teleport>
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

.construction-notice {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  padding: 1.25rem;
}

.construction-notice__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 10, 0.72);
}

.construction-notice__panel {
  position: relative;
  width: min(100%, 520px);
  background: var(--body-bg);
  color: var(--dark);
  border-top: 2px solid var(--accent);
  padding: clamp(1.5rem, 5vw, 2.4rem);
  box-shadow: 0 1.5rem 4rem rgba(12, 12, 10, 0.34);
}

.construction-notice__kicker {
  font-family: var(--font-latin-sans);
  font-size: 0.54rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}

.construction-notice h2 {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 5vw, 3rem);
  font-weight: 300;
  line-height: 1.08;
  letter-spacing: 0;
}

.construction-notice p:not(.construction-notice__kicker) {
  margin-top: 1rem;
  color: var(--muted);
  line-height: 1.85;
}

.construction-notice__button {
  margin-top: 1.5rem;
  min-height: 2.65rem;
  border: 1px solid var(--dark);
  background: var(--dark);
  color: #F5F4F0;
  padding: 0.72rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.12em;
  cursor: pointer;
  transition: background 0.2s ease, border-color 0.2s ease;
}

.construction-notice__button:hover {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
