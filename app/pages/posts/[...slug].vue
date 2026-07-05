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

const [{ data: post }, { data: allPosts }] = await Promise.all([
  useAsyncData(`post-${route.path}`, () => $fetch<Post>(`/api/posts/${slug.value}`).catch(() => null)),
  useFetch<Post[]>('/api/posts'),
])

if (!post.value) {
  throw createError({ statusCode: 404, statusMessage: 'Post not found', fatal: true })
}

const related = computed(() => {
  if (!allPosts.value || !post.value) return []
  const same = allPosts.value.filter(p => p.id !== post.value!.id && p.tag === post.value!.tag)
  const rest = allPosts.value.filter(p => p.id !== post.value!.id && p.tag !== post.value!.tag)
  return [...same, ...rest].slice(0, 3)
})

const heroStyle = computed(() => post.value?.heroStyle ?? 'standard')
const isDark = computed(() => heroStyle.value === 'minimal-dark')

// Reading progress + parallax
const progress = ref(0)
const parallaxY = ref(0)

onMounted(() => {
  window.addEventListener('scroll', () => {
    const total = document.documentElement.scrollHeight - window.innerHeight
    progress.value = total > 0 ? (window.scrollY / total) * 100 : 0
    parallaxY.value = window.scrollY * 0.15
  }, { passive: true })
})

async function handleShare() {
  try {
    if (navigator.share) {
      await navigator.share({ title: post.value?.title, url: window.location.href })
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
  } catch {}
}

useHead(() => ({
  title: `${post.value?.title?.replace(/\n+/g, ' ')} — CU Photo Club`,
  bodyAttrs: { style: isDark.value ? 'background:#0C0C0A' : '' },
}))
</script>

<template>
  <!-- Reading progress bar -->
  <div class="read-progress" :style="{ width: progress + '%' }" />

  <article v-if="post" :class="['post', `post--${heroStyle}`]">

    <!-- ── Standard hero ─────────────────────────────────────────────── -->
    <template v-if="heroStyle === 'standard'">
      <header class="std-head">
        <NuxtLink :to="localePath('/')" class="post-back">{{ t('posts.backToHome') }}</NuxtLink>
        <p class="std-head__eyebrow">{{ post.tag }} · {{ post.date }}</p>
        <h1 class="std-head__title">{{ post.title }}</h1>
        <p v-if="post.excerpt" class="std-head__excerpt">{{ post.excerpt }}</p>
        <p v-if="post.author" class="std-head__author">{{ post.author }}</p>
      </header>
      <div v-if="post.image" class="std-hero">
        <AppImg :src="post.image" :alt="post.title" width="1200" height="800"
          sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" eager />
      </div>
    </template>

    <!-- ── Dark full-bleed hero ──────────────────────────────────────── -->
    <header v-else-if="heroStyle === 'dark-full'" class="df-head">
      <div class="df-head__bg" :style="{ transform: `translateY(${parallaxY}px)` }">
        <img v-if="post.image" :src="post.image" :alt="post.title">
      </div>
      <div class="df-head__gradient" />
      <div class="df-head__inner">
        <NuxtLink :to="localePath('/')" class="post-back post-back--light">{{ t('posts.backToHome') }}</NuxtLink>
        <p class="df-head__tag">{{ post.tag }}</p>
        <h1 class="df-head__title">{{ post.title }}</h1>
        <div class="df-head__meta">
          <span v-if="post.author" class="df-head__author">{{ post.author }}</span>
          <span v-if="post.author" class="df-head__sep" />
          <span>{{ post.date }}</span>
        </div>
      </div>
    </header>

    <!-- ── Split hero ────────────────────────────────────────────────── -->
    <header v-else-if="heroStyle === 'split'" class="sp-head">
      <div class="sp-head__img">
        <img v-if="post.image" :src="post.image" :alt="post.title">
      </div>
      <div class="sp-head__content">
        <NuxtLink :to="localePath('/')" class="post-back post-back--light sp-head__back">{{ t('posts.backToHome') }}</NuxtLink>
        <p class="sp-head__tag">{{ post.tag }}</p>
        <h1 class="sp-head__title">{{ post.title }}</h1>
        <p v-if="post.excerpt" class="sp-head__excerpt">{{ post.excerpt }}</p>
        <div class="sp-head__meta">
          <span v-if="post.author" class="sp-head__author">{{ post.author }}</span>
          <span v-if="post.author" class="sp-head__sep" />
          <span>{{ post.date }}</span>
        </div>
      </div>
    </header>

    <!-- ── Minimal dark header ───────────────────────────────────────── -->
    <header v-else-if="heroStyle === 'minimal-dark'" class="md-head">
      <NuxtLink :to="localePath('/')" class="post-back post-back--dim">{{ t('posts.backToHome') }}</NuxtLink>
      <p class="md-head__tag">{{ post.tag }}</p>
      <h1 class="md-head__title">{{ post.title }}</h1>
      <p v-if="post.excerpt" class="md-head__sub">{{ post.excerpt }}</p>
      <div class="md-head__meta">
        <span v-if="post.author" class="md-head__author">{{ post.author }}</span>
        <span v-if="post.author" class="md-head__sep" />
        <span>{{ post.date }}</span>
      </div>
    </header>

    <!-- ── Body ─────────────────────────────────────────────────────── -->
    <div class="post__body">
      <template v-for="block in post.blocks" :key="block.id">

        <p v-if="block.type === 'text'" class="pb-text">{{ (block as any).content }}</p>

        <p v-else-if="block.type === 'lead'" class="pb-lead">{{ (block as any).content }}</p>

        <h2 v-else-if="block.type === 'heading'" class="pb-heading">{{ (block as any).content }}</h2>

        <h3 v-else-if="block.type === 'subheading'" class="pb-subheading">{{ (block as any).content }}</h3>

        <div v-else-if="block.type === 'pullquote'" class="pb-pullquote">{{ (block as any).content }}</div>

        <blockquote v-else-if="block.type === 'blockquote'" class="pb-blockquote">
          <span>{{ (block as any).content }}</span>
          <cite v-if="(block as any).cite">{{ (block as any).cite }}</cite>
        </blockquote>

        <figure v-else-if="block.type === 'image'" class="pb-image" :class="{ 'pb-image--breakout': (block as any).breakout }">
          <img :src="(block as any).src" :alt="(block as any).caption || ''">
          <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
        </figure>

        <figure v-else-if="block.type === 'photo-full'" class="pb-photo-full">
          <img :src="(block as any).src" :alt="(block as any).caption || ''">
          <figcaption v-if="(block as any).caption">{{ (block as any).caption }}</figcaption>
        </figure>

        <figure v-else-if="block.type === 'photo-pair'" class="pb-photo-pair">
          <img :src="(block as any).src1" alt="">
          <img :src="(block as any).src2" alt="">
          <figcaption v-if="(block as any).caption" class="pb-photo-pair__cap">{{ (block as any).caption }}</figcaption>
        </figure>

        <div v-else-if="block.type === 'divider'" class="pb-divider">· · ·</div>

        <div v-else-if="block.type === 'inset'" class="pb-inset">{{ (block as any).content }}</div>

        <div v-else-if="block.type === 'qanda'" class="pb-qanda">
          <div class="pb-qanda__q">{{ (block as any).question }}</div>
          <div class="pb-qanda__a">{{ (block as any).answer }}</div>
        </div>

      </template>

      <!-- Article footer -->
      <div class="post__footer">
        <div class="post__tags">
          <span class="post__tag-pill">{{ post.tag }}</span>
        </div>
        <button class="post__share" @click="handleShare">Share →</button>
      </div>
    </div>

    <!-- Author bio -->
    <div v-if="post.author" class="author-bio">
      <div class="author-bio__inner">
        <div class="author-bio__avatar">
          <img v-if="post.authorAvatar" :src="post.authorAvatar" :alt="post.author">
          <span v-else class="author-bio__initials">{{ post.author.charAt(0) }}</span>
        </div>
        <div>
          <p class="author-bio__name">{{ post.author }}</p>
          <p v-if="post.authorBio" class="author-bio__text">{{ post.authorBio }}</p>
        </div>
      </div>
    </div>

  </article>

  <!-- Related posts -->
  <section v-if="related.length" class="related" :class="{ 'related--dark': isDark }">
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

/* ─── Post shell ─────────────────────────────────────────────────────────── */
.post { overflow: visible; }

/* ─── Shared back link ───────────────────────────────────────────────────── */
.post-back {
  display: inline-block; font-size: 0.56rem; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--muted); text-decoration: none;
  margin-bottom: 2rem; transition: color 0.2s;
}
.post-back:hover { color: var(--accent); }
.post-back--light { color: rgba(245,244,240,0.45); }
.post-back--light:hover { color: var(--accent); }
.post-back--dim { color: rgba(245,244,240,0.3); }
.post-back--dim:hover { color: var(--accent); }

/* ─── Standard hero ──────────────────────────────────────────────────────── */
.std-head {
  max-width: 760px; margin: 0 auto; padding: 4rem 3rem 2rem;
}
.std-head__eyebrow {
  font-size: 0.56rem; letter-spacing: 0.28em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 1.25rem;
}
.std-head__title {
  font-family: var(--font-serif); font-size: clamp(2.2rem, 4.5vw, 3.8rem);
  font-weight: 200; line-height: 1.05; letter-spacing: -0.025em; margin-bottom: 1.5rem; white-space: pre-line;
}
.std-head__excerpt {
  font-size: 0.95rem; color: var(--muted); line-height: 1.8; margin-bottom: 1rem;
}
.std-head__author {
  font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 0;
}
.std-hero { max-width: 760px; margin: 0 auto; padding: 0 3rem 3rem; }
.std-hero :deep(img) { width: 100%; height: auto; display: block; max-height: 560px; object-fit: cover; }

/* ─── Dark full-bleed hero ───────────────────────────────────────────────── */
.df-head {
  position: relative; min-height: 72svh; background: #0C0C0A;
  display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden;
}
.df-head__bg {
  position: absolute; inset: 0; will-change: transform;
}
.df-head__bg img {
  width: 100%; height: 100%; object-fit: cover; display: block; opacity: 0.4;
}
.df-head__gradient {
  position: absolute; inset: 0;
  background: linear-gradient(to bottom, rgba(12,12,10,0.4) 0%, rgba(12,12,10,0.05) 35%, rgba(12,12,10,0.92) 100%);
}
.df-head__inner {
  position: relative; z-index: 2;
  max-width: 900px; margin: 0 auto; width: 100%; padding: 0 3rem 3.5rem;
}
.df-head__tag {
  font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 1.25rem;
}
.df-head__title {
  font-family: var(--font-serif); font-size: clamp(3rem, 6.5vw, 5.5rem);
  font-weight: 200; line-height: 0.93; letter-spacing: -0.03em;
  color: #F5F4F0; margin-bottom: 2rem; max-width: 800px; white-space: pre-line;
}
.df-head__meta {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.58rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.45);
}
.df-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.df-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.3); }

/* ─── Split hero ─────────────────────────────────────────────────────────── */
.sp-head {
  display: grid; grid-template-columns: 1fr 1fr;
  min-height: 100svh; background: #0C0C0A;
}
.sp-head__img { position: relative; overflow: hidden; }
.sp-head__img img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block;
}
.sp-head__img::after {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(to top, rgba(12,12,10,0.5), transparent 55%);
}
.sp-head__content {
  padding: 8rem 4rem 4rem; display: flex; flex-direction: column;
  justify-content: flex-end; color: #F5F4F0; position: relative;
}
.sp-head__back { position: absolute; top: 6rem; left: 4rem; }
.sp-head__tag {
  font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 1rem;
}
.sp-head__title {
  font-family: var(--font-serif); font-size: clamp(2.5rem, 5vw, 4.5rem);
  font-weight: 200; line-height: 0.95; letter-spacing: -0.03em; margin-bottom: 1.5rem; white-space: pre-line;
}
.sp-head__excerpt {
  font-size: 0.85rem; line-height: 1.85;
  color: rgba(245,244,240,0.55); max-width: 440px; margin-bottom: 2rem;
}
.sp-head__meta {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.56rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.4);
}
.sp-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.sp-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.25); }

/* ─── Minimal dark header ────────────────────────────────────────────────── */
.md-head {
  text-align: center; padding: 10rem 3rem 6rem;
  max-width: 720px; margin: 0 auto;
}
.md-head .post-back { display: block; margin-bottom: 2.5rem; }
.md-head__tag {
  font-size: 0.52rem; letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--accent); margin-bottom: 1.25rem;
}
.md-head__title {
  font-family: var(--font-serif); font-size: clamp(3rem, 6vw, 5rem);
  font-weight: 200; line-height: 0.92; letter-spacing: -0.03em;
  color: #F5F4F0; margin-bottom: 1.25rem; white-space: pre-line;
}
.md-head__sub {
  font-size: 0.95rem; color: rgba(245,244,240,0.45);
  line-height: 1.8; max-width: 520px; margin: 0 auto 2rem;
}
.md-head__meta {
  display: flex; align-items: center; justify-content: center; gap: 0.75rem;
  font-size: 0.56rem; letter-spacing: 0.12em; color: rgba(245,244,240,0.35);
}
.md-head__author { color: var(--accent); letter-spacing: 0.16em; text-transform: uppercase; }
.md-head__sep { width: 2px; height: 2px; border-radius: 50%; background: rgba(245,244,240,0.2); }

/* ─── Body ───────────────────────────────────────────────────────────────── */
.post__body {
  max-width: 760px; margin: 0 auto; padding: 3rem 3rem 4rem;
  display: flex; flex-direction: column; overflow: visible;
}

/* ─── Block: Paragraph ───────────────────────────────────────────────────── */
.pb-text { font-size: 1rem; line-height: 1.95; color: var(--dark); margin-bottom: 1.5rem; }

/* ─── Block: Lead ────────────────────────────────────────────────────────── */
.pb-lead {
  font-family: var(--font-serif); font-size: 1.15rem; font-weight: 400;
  line-height: 1.7; color: var(--dark); margin-bottom: 2.5rem;
  padding-left: 1.5rem; border-left: 2px solid var(--accent);
}

/* ─── Block: Heading ─────────────────────────────────────────────────────── */
.pb-heading {
  font-family: var(--font-serif); font-size: 1.8rem; font-weight: 300;
  line-height: 1.15; letter-spacing: -0.02em; margin: 3.5rem 0 1.25rem;
}

/* ─── Block: Subheading ──────────────────────────────────────────────────── */
.pb-subheading {
  font-family: var(--font-serif); font-size: 1.3rem; font-weight: 400;
  line-height: 1.2; margin: 2.5rem 0 1rem;
}

/* ─── Block: Pull quote ──────────────────────────────────────────────────── */
.pb-pullquote {
  font-family: var(--font-serif); font-size: 1.9rem; font-weight: 200;
  font-style: italic; line-height: 1.25; color: var(--accent);
  margin: 3rem 0; padding: 0 0 0 2.5rem; border-left: 2px solid var(--accent);
}
.post--minimal-dark .pb-pullquote {
  border-left: none; padding-left: 0; text-align: center;
}

/* ─── Block: Blockquote ──────────────────────────────────────────────────── */
.pb-blockquote {
  font-family: var(--font-serif); font-size: 1.4rem; font-weight: 200;
  font-style: italic; line-height: 1.45;
  margin: 2.5rem 0; padding: 1.5rem 2rem;
  border-left: 2px solid var(--accent); background: var(--paper);
  display: flex; flex-direction: column; gap: 0.75rem;
}
.pb-blockquote cite {
  font-size: 0.7rem; font-style: normal; letter-spacing: 0.12em; color: var(--muted);
}

/* ─── Block: Image ───────────────────────────────────────────────────────── */
.pb-image { margin: 3rem 0; }
.pb-image--breakout { margin: 3rem -4rem; }
.pb-image img { width: 100%; display: block; }
.pb-image figcaption {
  font-size: 0.62rem; color: var(--muted); letter-spacing: 0.08em;
  padding: 0.75rem 0 0; text-align: right;
}

/* ─── Block: Full-bleed photo ────────────────────────────────────────────── */
.pb-photo-full { margin: 5rem calc(-50vw + 50%); width: 100vw; }
.pb-photo-full img { width: 100%; height: 90vh; object-fit: cover; display: block; }
.pb-photo-full figcaption {
  font-size: 0.58rem; color: var(--muted); letter-spacing: 0.08em;
  padding: 0.75rem 3rem 0; text-align: right;
}

/* ─── Block: Photo pair ──────────────────────────────────────────────────── */
.pb-photo-pair {
  display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;
  margin: 5rem calc(-50vw + 50%); width: 100vw; padding: 0 3rem;
}
.pb-photo-pair img { width: 100%; height: 70vh; object-fit: cover; display: block; }
.pb-photo-pair__cap {
  grid-column: 1 / -1; font-size: 0.58rem; color: var(--muted);
  letter-spacing: 0.08em; padding-top: 0.65rem; text-align: right;
}

/* ─── Block: Divider ─────────────────────────────────────────────────────── */
.pb-divider {
  text-align: center; font-size: 0.82rem; color: var(--muted);
  margin: 3rem 0; letter-spacing: 0.5em;
}

/* ─── Block: Inset / callout ─────────────────────────────────────────────── */
.pb-inset {
  font-size: 0.88rem; line-height: 1.85; color: var(--muted);
  background: var(--paper); padding: 1.5rem 2rem; margin: 2rem 0;
  border-left: 2px solid var(--accent);
}

/* ─── Block: Q & A ───────────────────────────────────────────────────────── */
.pb-qanda { margin-bottom: 2.5rem; }
.pb-qanda__q {
  font-family: var(--font-serif); font-size: 1.05rem; font-weight: 500;
  line-height: 1.3; margin-bottom: 1rem;
  display: flex; align-items: flex-start; gap: 1rem;
}
.pb-qanda__q::before {
  content: 'Q'; flex-shrink: 0;
  font-family: var(--font-sans); font-size: 0.58rem; font-weight: 500;
  letter-spacing: 0.1em; color: var(--accent);
  background: var(--paper); width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--subtle); margin-top: 0.05rem;
}
.pb-qanda__a {
  font-size: 0.92rem; line-height: 1.85; color: var(--dark);
  display: flex; align-items: flex-start; gap: 1rem;
}
.pb-qanda__a::before {
  content: 'A'; flex-shrink: 0;
  font-family: var(--font-sans); font-size: 0.58rem; font-weight: 500;
  background: var(--dark); color: #F5F4F0; width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  margin-top: 0.05rem;
}

/* ─── Minimal dark body overrides ────────────────────────────────────────── */
.post--minimal-dark .pb-text     { color: rgba(245,244,240,0.65); }
.post--minimal-dark .pb-lead     { color: rgba(245,244,240,0.8); border-left-color: var(--accent); }
.post--minimal-dark .pb-heading  { color: #F5F4F0; }
.post--minimal-dark .pb-subheading { color: #F5F4F0; }
.post--minimal-dark .pb-blockquote { background: rgba(245,244,240,0.05); }
.post--minimal-dark .pb-blockquote cite { color: rgba(245,244,240,0.35); }
.post--minimal-dark .pb-divider  { color: rgba(245,244,240,0.15); }
.post--minimal-dark .pb-inset    { background: rgba(245,244,240,0.05); color: rgba(245,244,240,0.5); }
.post--minimal-dark .pb-qanda__q { color: rgba(245,244,240,0.9); }
.post--minimal-dark .pb-qanda__q::before { background: rgba(245,244,240,0.06); border-color: rgba(245,244,240,0.12); }
.post--minimal-dark .pb-qanda__a { color: rgba(245,244,240,0.65); }
.post--minimal-dark .pb-photo-full figcaption { color: rgba(245,244,240,0.25); }
.post--minimal-dark .pb-photo-pair__cap { color: rgba(245,244,240,0.25); }
.post--minimal-dark .pb-image figcaption { color: rgba(245,244,240,0.25); }

/* ─── Article footer ─────────────────────────────────────────────────────── */
.post__footer {
  margin-top: 4rem; padding-top: 2rem;
  border-top: 1px solid var(--subtle);
  display: flex; justify-content: space-between; align-items: center;
}
.post--minimal-dark .post__footer { border-top-color: rgba(245,244,240,0.08); }
.post__tag-pill {
  font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase;
  color: var(--muted); padding: 0.35rem 0.75rem;
  border: 1px solid var(--subtle); display: inline-block;
}
.post--minimal-dark .post__tag-pill { color: rgba(245,244,240,0.3); border-color: rgba(245,244,240,0.1); }
.post__share {
  font-family: var(--font-sans); font-size: 0.54rem; letter-spacing: 0.16em;
  text-transform: uppercase; color: var(--muted); background: none;
  border: none; cursor: pointer; transition: color 0.2s;
}
.post__share:hover { color: var(--accent); }
.post--minimal-dark .post__share { color: rgba(245,244,240,0.3); }

/* ─── Author bio ─────────────────────────────────────────────────────────── */
.author-bio {
  background: var(--paper); border-top: 1px solid var(--subtle); padding: 3rem;
}
.post--minimal-dark .author-bio {
  background: rgba(245,244,240,0.04); border-top-color: rgba(245,244,240,0.08);
}
.author-bio__inner {
  max-width: 760px; margin: 0 auto;
  display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: start;
}
.author-bio__avatar {
  width: 56px; height: 56px; border-radius: 50%; overflow: hidden;
  background: var(--subtle); display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}
.author-bio__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.author-bio__initials {
  font-family: var(--font-serif); font-size: 1.2rem; font-weight: 300; color: var(--muted);
}
.author-bio__name {
  font-family: var(--font-serif); font-size: 1.1rem; font-weight: 400; margin-bottom: 0.4rem;
}
.post--minimal-dark .author-bio__name { color: rgba(245,244,240,0.9); }
.author-bio__text { font-size: 0.8rem; color: var(--muted); line-height: 1.7; }
.post--minimal-dark .author-bio__text { color: rgba(245,244,240,0.4); }

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

/* ─── Responsive ─────────────────────────────────────────────────────────── */
@media (max-width: 1000px) {
  .sp-head { grid-template-columns: 1fr; min-height: auto; }
  .sp-head__img { min-height: 50svh; }
  .sp-head__content { padding: 6rem 2.5rem 3rem; }
  .sp-head__back { top: 4rem; left: 2.5rem; }
  .pb-image--breakout { margin: 2.5rem 0; }
  .related__grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 720px) {
  .sp-head__content { padding: 5rem 1.5rem 2.5rem; }
  .sp-head__back { top: 3.5rem; left: 1.5rem; }
  .pb-photo-pair { grid-template-columns: 1fr; }
  .pb-photo-pair img { height: 60vh; }
  .related__grid { grid-template-columns: 1fr; }
  .author-bio { padding: 2rem 1.5rem; }
  .author-bio__inner { grid-template-columns: 1fr; }
}
@media (max-width: 640px) {
  .std-head, .post__body { padding-left: 1.5rem; padding-right: 1.5rem; }
  .std-hero { padding-left: 1.5rem; padding-right: 1.5rem; }
  .md-head { padding: 7rem 1.5rem 4rem; }
  .df-head__inner { padding: 0 1.5rem 2.5rem; }
  .pb-photo-full img { height: 60vh; }
  .pb-photo-pair { padding: 0 1.5rem; }
  .pb-photo-pair img { height: 50vh; }
  .related { padding: 4rem 1.5rem; }
  .post__footer { flex-direction: column; align-items: flex-start; gap: 1rem; }
}
</style>
