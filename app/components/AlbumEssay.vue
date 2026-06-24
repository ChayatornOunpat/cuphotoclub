<script setup lang="ts">
interface AlbumImage { src: string, caption?: string }
interface Album {
  title: string
  category: string
  date: string
  location?: string
  excerpt: string
  coverIndex: number
  images: AlbumImage[]
}
const props = defineProps<{ album: Album }>()
const { t } = useI18n()
const localePath = useLocalePath()

const cover = computed(() => props.album.images[props.album.coverIndex]?.src ?? props.album.images[0]!.src)

// Set-and-forget: the admin only supplies images; the essay rhythm is generated
// here (deterministic, so SSR-safe). Recipes cycle and consume the flat image
// list; if a recipe needs more images than remain, it falls back to a single.
interface Row { type: 'single' | 'single-right' | 'bleed' | 'pair', items: { src: string, caption?: string, n: number }[] }
const rows = computed<Row[]>(() => {
  const recipe: { type: Row['type'], n: number }[] = [
    { type: 'single', n: 1 },
    { type: 'bleed', n: 1 },
    { type: 'pair', n: 2 },
    { type: 'single-right', n: 1 },
    { type: 'bleed', n: 1 }
  ]
  const out: Row[] = []
  const imgs = props.album.images
  let i = 0
  let r = 0
  while (i < imgs.length) {
    let step = recipe[r % recipe.length]!
    if (step.n > imgs.length - i) step = { type: 'single', n: 1 } // graceful tail
    const items = imgs.slice(i, i + step.n).map((img, k) => ({ src: img.src, caption: img.caption, n: i + k + 1 }))
    out.push({ type: step.type, items })
    i += step.n
    r++
  }
  return out
})

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <article>
    <!-- COVER -->
    <header class="cover" data-chrome-header>
      <div class="cover__bg" data-parallax>
        <AppImg :src="cover" :alt="album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="cover__img" eager />
      </div>
      <NuxtLink :to="localePath('/albums')" class="cover__back">{{ t('albums.coverBack') }}</NuxtLink>
      <div class="cover__body">
        <p class="cover__kicker">{{ t('albums.albumKicker', { category: album.category }) }}</p>
        <h1 class="cover__title">{{ album.title }}</h1>
        <div class="cover__meta">
          <span>{{ album.date }}</span><span class="dot" />
          <span>{{ t('albums.metaFrames', { count: album.images.length }) }}</span>
          <template v-if="album.location"><span class="dot" /><span>{{ album.location }}</span></template>
        </div>
      </div>
    </header>
    <div class="cut-line" />

    <!-- INTRO -->
    <section class="intro">
      <p class="intro__lead">{{ album.excerpt }}</p>
    </section>

    <!-- ESSAY FLOW -->
    <section class="essay">
      <template v-for="(row, ri) in rows" :key="ri">
        <div v-if="row.type === 'pair'" class="row row--pair">
          <figure v-for="item in row.items" :key="item.n">
            <div class="frame"><AppImg :src="item.src" :alt="item.caption || album.title" sizes="sm:100vw lg:50vw" /></div>
            <figcaption><span class="n">{{ pad(item.n) }}</span> {{ item.caption }}</figcaption>
          </figure>
        </div>
        <figure
          v-else
          class="row"
          :class="{ 'row--single': row.type === 'single' || row.type === 'single-right', right: row.type === 'single-right', 'row--bleed': row.type === 'bleed' }"
        >
          <div class="frame"><AppImg :src="row.items[0]!.src" :alt="row.items[0]!.caption || album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:1400px xxl:1400px" /></div>
          <figcaption><span class="n">{{ pad(row.items[0]!.n) }}</span> {{ row.items[0]!.caption }}</figcaption>
        </figure>
      </template>
    </section>

    <!-- ALBUM NAV -->
    <section class="albnav">
      <div class="albnav__inner">
        <NuxtLink :to="localePath('/albums')" class="albnav__back">{{ t('albums.allAlbums') }}</NuxtLink>
      </div>
    </section>
  </article>
</template>

<style scoped>
.cover {
  height: 100svh;
  background: var(--hero-bg);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}
.cover__bg { position: absolute; inset: 0; will-change: transform; }
.cover__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(12, 12, 10, 0.4) 0%, transparent 35%, rgba(12, 12, 10, 0.85) 100%);
}
:deep(.cover__img) { width: 100%; height: 100%; object-fit: cover; opacity: 0.55; display: block; }
.cover__back {
  position: absolute; top: 6rem; left: 3rem; z-index: 3;
  font-size: 0.56rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: rgba(245, 244, 240, 0.7); text-decoration: none; transition: color 0.2s;
}
.cover__back:hover { color: var(--accent); }
.cover__body { position: relative; z-index: 2; padding: 0 3rem 3.5rem; max-width: 1380px; margin: 0 auto; width: 100%; }
.cover__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.6); margin-bottom: 1.5rem; }
.cover__kicker span { color: var(--accent); }
.cover__title { font-family: var(--font-serif); font-size: clamp(3.5rem, 9vw, 9rem); font-weight: 200; line-height: 0.9; letter-spacing: -0.03em; color: #F5F4F0; }
.cover__meta { margin-top: 2rem; display: flex; gap: 1.5rem; align-items: center; font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(245, 244, 240, 0.5); }
.cover__meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }

.intro { padding: 6rem 3rem 2rem; max-width: 880px; margin: 0 auto; }
.intro__lead { font-family: var(--font-serif); font-size: clamp(1.6rem, 3vw, 2.6rem); font-weight: 200; line-height: 1.4; letter-spacing: -0.01em; }

.essay { padding: 3rem 3rem 6rem; max-width: 1380px; margin: 0 auto; }
figure { margin: 0; }
.frame { overflow: hidden; background: var(--hero-bg); }
.frame :deep(img) { width: 100%; display: block; object-fit: cover; transition: transform 1s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.frame:hover :deep(img) { transform: scale(1.03); }
figcaption { display: flex; gap: 1rem; align-items: baseline; margin-top: 1rem; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
figcaption .n { color: var(--accent); font-weight: 500; }

.row { margin-bottom: 4.5rem; }
.row--single { max-width: 760px; }
.row--single.right { margin-left: auto; }
.row--bleed { max-width: 100%; }
.row--pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 4.5rem; }

.albnav { background: var(--paper); border-top: 1px solid var(--subtle); border-bottom: 1px solid var(--subtle); padding: 3.5rem 3rem; }
.albnav__inner { max-width: 1380px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 2rem; flex-wrap: wrap; }
.albnav__back { font-size: 0.58rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color 0.2s; }
.albnav__back:hover { color: var(--accent); }

@media (max-width: 720px) {
  .cover__back { left: 1.5rem; }
  .cover__body { padding: 0 1.5rem 2.5rem; }
  .intro, .essay, .albnav { padding-left: 1.5rem; padding-right: 1.5rem; }
  .row--pair { grid-template-columns: 1fr; }
}
</style>
