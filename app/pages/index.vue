<script setup lang="ts">
import { defaultSite } from '~/utils/defaultSite'
import { prewarmPhotoGrid } from '~/utils/photoGridPreload'

definePageMeta({ layout: 'site' })

const site = ref(defaultSite)
const { t } = useI18n()
const localePath = useLocalePath()
const localizedPath = useLocalizedContentPath()
const localizedSite = useLocalizedSite(site)

// Both awaited fetches run in parallel — awaiting them one after another
// would serialize two round trips into the SSR time.
const [{ data: home }, { data: heroImagesData }] = await Promise.all([
  useAsyncData('home', () =>
    $fetch('/api/home').catch(() => ({ albums: [], posts: [], events: [] }))
  ),
  useAsyncData('hero-images', () =>
    $fetch<{ images: string[] }>('/api/hero-images').catch(() => ({ images: [] }))
  )
])

function imageSrc(key: string | null | undefined) {
  const value = key?.trim()
  if (!value) return ''
  if (/^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }
  return `/images/${value.replace(/^\/+/, '')}`
}

function albumPath(a: { slug: string }) {
  return albumRoutePath(a.slug)
}

// ── Hero background: randomise from the admin-managed image pool.
//    useState pins the seed on the server so client hydration matches.
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

// ── Landing gate: hold a loading screen until the hero image is on screen so
//    visitors never see the page assemble behind a blank hero. A safety timeout
//    guarantees the page is revealed even if the image errors or never fires
//    its load event.
const heroReady = ref(false)
let heroReadyTimer: ReturnType<typeof setTimeout> | null = null

function onHeroReady() {
  heroReady.value = true
  if (heroReadyTimer) {
    clearTimeout(heroReadyTimer)
    heroReadyTimer = null
  }
}

// While the loading screen is up, freeze background scrolling.
watch(heroReady, (ready) => {
  if (import.meta.client) {
    document.documentElement.style.overflow = ready ? '' : 'hidden'
  }
}, { immediate: true })

function onScroll() {
  const total = document.body.scrollHeight - window.innerHeight
  progress.value = total > 0 ? (window.scrollY / total) * 100 : 0
  navLight.value = window.scrollY > window.innerHeight * 0.9
}

function dismissConstructionNotice() {
  constructionNoticeOpen.value = false
  if (import.meta.client) sessionStorage.setItem(constructionNoticeKey, '1')
}

function prewarmPhotoGridWhenIdle() {
  // typeof check (not `in`): `in` narrows window to never in the else branch
  // because lib.dom declares requestIdleCallback unconditionally.
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => void prewarmPhotoGrid(), { timeout: 3000 })
    return
  }
  window.setTimeout(() => void prewarmPhotoGrid(), 1200)
}

onMounted(() => {
  onScroll()
  prewarmPhotoGridWhenIdle()
  constructionNoticeOpen.value = sessionStorage.getItem(constructionNoticeKey) !== '1'
  window.addEventListener('scroll', onScroll, { passive: true })
  // Fallback: never trap the visitor behind the loading screen.
  heroReadyTimer = setTimeout(onHeroReady, 6000)
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (heroReadyTimer) clearTimeout(heroReadyTimer)
  if (import.meta.client) document.documentElement.style.overflow = ''
})

// The homepage sets its own full title, so opt out of app.vue's titleTemplate
// (which would append a second "· CU Photo Club").
const origin = useRequestURL().origin
useHead({
  titleTemplate: null,
  title: () => `${t('nav.logo')} — Chulalongkorn University`,
  script: [
    {
      // WebSite structured data + sitelinks search box.
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'CU Photo Club',
        url: origin,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${origin}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      })
    }
  ]
})
useSeoMeta({
  description: () => t('home.metaDescription'),
  ogTitle: () => `${t('nav.logo')} — Chulalongkorn University`,
  ogDescription: () => t('home.metaDescription'),
  ogImage: `${origin}/club-icon.jpg`
})
</script>

<template>
  <div v-if="localizedSite">
    <Teleport to="body">
      <Transition name="hero-gate">
        <div v-if="!heroReady" class="hero-gate" aria-hidden="true">
          <div class="hero-gate__mark">CU PHOTOCLUB</div>
          <div class="hero-gate__bar"><span /></div>
        </div>
      </Transition>
    </Teleport>

    <div id="progress" :style="{ width: progress + '%' }" />

    <SiteNav :links="localizedSite.nav.links" :light="navLight" />

    <SiteHero :hero="heroWithImage ?? localizedSite.hero" @ready="onHeroReady" />

    <!-- Signature pink line: dark → light transition -->
    <div class="cut-line" />

    <section class="intro-photos">
      <div class="intro-photos__inner">
        <div class="intro-photos__pile">
          <div
            v-for="(a, i) in featuredAlbums.slice(0, 3)"
            :key="i"
            class="intro-photos__photo"
            :style="{ '--r': `${(i - 1) * 6}deg` }"
          >
            <AppImg :src="a.cover" :alt="a.title" sizes="120px" optimize />
          </div>
        </div>
        <div class="intro-photos__text">
          <p class="intro-photos__lead">{{ t('home.introLead') }}</p>
          <p class="intro-photos__body">{{ t('home.introBody') }}</p>
          <NuxtLink :to="localePath('/contact')" class="intro-photos__link">{{ t('home.introLink') }}</NuxtLink>
        </div>
      </div>
    </section>

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
          <div class="construction-notice__heading">
            <h2 id="construction-title">{{ t('home.constructionTitle') }}</h2>
            <span class="construction-notice__mark" aria-hidden="true">
              <Icon name="heroicons:wrench-screwdriver" />
            </span>
          </div>
          <p>
            {{ t('home.constructionBody') }}
          </p>
          <button type="button" class="construction-notice__button" @click="dismissConstructionNotice">
            {{ t('home.constructionButton') }}
          </button>
        </section>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
/* ── Landing loading screen: sits above everything until the hero image is
   ready, then fades away to reveal the fully-assembled page. */
.hero-gate {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.75rem;
  background: var(--hero-bg);
}
.hero-gate__mark {
  font-family: var(--font-latin-sans);
  font-size: 0.62rem;
  letter-spacing: 0.42em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.65);
  padding-left: 0.42em;
}
.hero-gate__bar {
  position: relative;
  width: 120px;
  height: 1px;
  background: rgba(245, 244, 240, 0.14);
  overflow: hidden;
}
.hero-gate__bar span {
  position: absolute;
  inset: 0;
  width: 40%;
  background: var(--accent);
  animation: hero-gate-slide 1.1s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
@keyframes hero-gate-slide {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(350%); }
}
.hero-gate-leave-active {
  transition: opacity 0.6s ease;
}
.hero-gate-leave-to {
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .hero-gate__bar span { animation: none; width: 100%; opacity: 0.5; }
}

.intro-photos { background: var(--body-bg); padding: 4rem 3rem; }
.intro-photos__inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; gap: 3.5rem; }
.intro-photos__pile { display: flex; flex-shrink: 0; }
.intro-photos__photo {
  width: 120px; height: 120px; margin-left: -28px; border: 6px solid #fff;
  box-shadow: 0 0.6rem 1.6rem rgba(12, 12, 10, 0.18); background: var(--paper);
  overflow: hidden; transform: rotate(var(--r)); transition: transform 0.2s ease;
}
.intro-photos__photo:first-child { margin-left: 0; }
.intro-photos__photo :deep(img) { width: 100%; height: 100%; object-fit: cover; display: block; }
.intro-photos__pile:hover .intro-photos__photo { transform: rotate(0deg) translateY(-4px); }
.intro-photos__text { max-width: 480px; }
.intro-photos__lead {
  font-family: var(--font-serif); font-size: clamp(1.4rem, 2.6vw, 2rem); font-weight: 300;
  line-height: 1.3; color: var(--dark); margin-bottom: 1rem;
}
.intro-photos__body { font-size: 0.85rem; line-height: 1.85; color: var(--muted); margin-bottom: 1.25rem; }
.intro-photos__link { color: var(--accent); text-decoration: none; font-size: 0.75rem; font-weight: 500; }
.intro-photos__link:hover { text-decoration: underline; }

@media (max-width: 720px) {
  .intro-photos { padding: 3rem 1.5rem; }
  .intro-photos__inner { flex-direction: column; align-items: flex-start; gap: 2rem; }
  .intro-photos__pile { align-self: center; }
}

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

.construction-notice__heading {
  display: flex;
  align-items: center;
  gap: clamp(1rem, 4vw, 2rem);
}

.construction-notice__heading h2 {
  flex: 1;
}

.construction-notice__mark {
  display: inline-grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--accent);
  font-size: clamp(3.25rem, 9vw, 4.6rem);
}

.construction-notice__mark :deep(svg),
.construction-notice__mark :deep(.iconify) {
  width: 1em;
  height: 1em;
  stroke-width: 1.15;
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
