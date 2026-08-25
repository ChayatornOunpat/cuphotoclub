<script setup lang="ts">
import type { Post } from '~~/shared/types'

definePageMeta({ layout: 'site' })
const route = useRoute()
const { t } = useI18n()
const localePath = useLocalePath()

const slug = computed(() => {
  const value = route.params.slug
  return Array.isArray(value) ? value.join('/') : String(value)
})

const { data: post } = await useAsyncData(`post-${route.path}`, () => $fetch<Post>(`/api/posts/${slug.value}`).catch(() => null))

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

// Server picks up to 3 related posts (same tag first, then most recent) —
// no full-list fetch on the client.
const { data: related } = await useAsyncData(`related-${route.path}`, () =>
  $fetch<Post[]>('/api/posts', { query: { relatedTo: post.value!.id, limit: 3 } }).catch(() => [] as Post[]),
)

const isDark = computed(() => post.value?.heroStyle === 'minimal-dark')

// Reading progress bar
const progress = ref(0)

function onScroll() {
  const total = document.documentElement.scrollHeight - window.innerHeight
  progress.value = total > 0 ? (window.scrollY / total) * 100 : 0
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))

async function handleShare() {
  try {
    if (navigator.share) {
      await navigator.share({ title: post.value?.title, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
  } catch {
    // Share sheet dismissed, or clipboard denied — nothing to report.
  }
}

useHead(() => ({
  bodyAttrs: { style: isDark.value ? 'background:#0C0C0A' : '' },
}))

// Social link previews: og:image must be an absolute URL or scrapers ignore it.
// app.vue's titleTemplate appends "· CU Photo Club" — don't add a suffix here.
const origin = useSiteOrigin()
const fallbackDescription = useSeoFallbackDescription()
const coverUrl = computed(() => {
  const src = post.value?.image
  if (!src) return undefined
  return /^https?:\/\//i.test(src) ? src : `${origin}${src.startsWith('/') ? '' : '/images/'}${src}`
})

useSeoMeta({
  title: () => post.value?.title?.replace(/\n+/g, ' '),
  ogTitle: () => post.value?.title?.replace(/\n+/g, ' '),
  description: () => post.value?.excerpt?.replace(/\n+/g, ' ') || fallbackDescription.value,
  ogDescription: () => post.value?.excerpt?.replace(/\n+/g, ' ') || fallbackDescription.value,
  ogImage: () => coverUrl.value,
  twitterImage: () => coverUrl.value,
  ogType: 'article',
  twitterCard: () => (coverUrl.value ? 'summary_large_image' : 'summary')
})
</script>

<template>
  <!-- Reading progress bar -->
  <div class="read-progress" :style="{ width: progress + '%' }" />

  <PublicPostArticle
    v-if="post"
    :post="post"
    :back-to="localePath('/')"
    :back-label="t('posts.backToHome')"
    shareable
    @share="handleShare"
  />

  <!-- Related posts -->
  <section v-if="related?.length" class="related" :class="{ 'related--dark': isDark }">
    <div class="related__inner">
      <div class="related__eyebrow"><span class="related__eyebrow-label">More</span> from the blog</div>
      <div class="related__grid">
        <NuxtLink v-for="r in related" :key="r.id" :to="localePath(`/posts/${r.id}`)" class="rcard">
          <div class="rcard__img">
            <img :src="r.image" :alt="r.title" loading="lazy">
          </div>
          <p class="rcard__tag">{{ r.tag }}</p>
          <h3 class="rcard__title">{{ r.title }}</h3>
          <p class="rcard__date">{{ r.date }}</p>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style>
/* global: body dark-mode for minimal-dark posts */
body[style*="background:#0C0C0A"] { color: #F5F4F0; }
</style>

<style scoped>
/* ─── Progress bar ───────────────────────────────────────────────────────── */
.read-progress {
  position: fixed; top: 0; left: 0; z-index: 200;
  height: 2px; background: var(--accent); transition: width 0.1s linear;
  pointer-events: none;
}

/* ─── Related posts ──────────────────────────────────────────────────────── */
.related {
  background: var(--body-bg); padding: 5rem 3rem 6rem;
  border-top: 1px solid var(--subtle);
}
.related--dark {
  background: var(--body-bg); border-top: none;
}
.related__inner { max-width: 1200px; margin: 0 auto; }
.related__eyebrow {
  font-size: 0.54rem; letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--muted); display: flex; align-items: center; gap: 1.25rem;
  margin-bottom: 2.5rem;
}
.related__eyebrow::after { content: ''; flex: 1; height: 1px; background: var(--subtle); }
.related__eyebrow-label { color: var(--accent); font-weight: 500; }
.related__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
.rcard { display: block; text-decoration: none; color: inherit; cursor: pointer; }
.rcard__img { aspect-ratio: 16/9; overflow: hidden; margin-bottom: 1.25rem; }
.rcard__img img {
  width: 100%; height: 100%; object-fit: cover; display: block;
}
.rcard__tag {
  font-size: 0.52rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 0.65rem;
}
.rcard__title {
  font-family: var(--font-serif); font-size: 1.15rem; font-weight: 400;
  line-height: 1.25; letter-spacing: -0.01em; transition: color 0.2s;
  border-top: 1px solid var(--subtle); padding-top: 1rem; white-space: pre-line;
}
.rcard:hover .rcard__title { color: var(--accent); }
.rcard__date { font-size: 0.58rem; color: var(--muted); letter-spacing: 0.1em; margin-top: 0.6rem; }

@media (max-width: 1000px) {
  .related__grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .related__grid { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .related { padding: 4rem 1.5rem; }
}
</style>
