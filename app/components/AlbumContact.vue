<script setup lang="ts">
interface AlbumCell { type: string, span: number, src?: string, caption?: string, content?: string }
interface AlbumRow { cells: AlbumCell[] }
interface Album {
  title: string
  category: string
  date: string
  excerpt: string
  coverSrc: string
  rows: AlbumRow[]
}
const props = defineProps<{ album: Album, disableNavigation?: boolean, selectedRow?: number, selectedCell?: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const cover = computed(() => props.album.coverSrc)
const coverAspect = ref<number | null>(null)
let coverMeasureId = 0

const coverOrientation = computed(() => {
  const aspect = coverAspect.value
  if (!aspect) return 'landscape'
  if (aspect < 0.82) return 'portrait'
  if (aspect < 1.18) return 'square'
  return 'landscape'
})

// Flat list of image cells with their row/cell coordinates for admin selection
const imageCells = computed(() => {
  const result: { src: string, caption?: string, row: number, cell: number }[] = []
  for (let ri = 0; ri < props.album.rows.length; ri++) {
    for (let ci = 0; ci < props.album.rows[ri].cells.length; ci++) {
      const cell = props.album.rows[ri].cells[ci]
      if (cell.type === 'image') result.push({ src: cell.src ?? '', caption: cell.caption, row: ri, cell: ci })
    }
  }
  return result
})

const pad = (n: number) => String(n).padStart(2, '0')

// Lightbox
const open = ref(false)
const idx = ref(0)
const current = computed(() => imageCells.value[idx.value])

function show(i: number) {
  if (props.disableNavigation) return
  idx.value = (i + imageCells.value.length) % imageCells.value.length
  open.value = true
}
function close() { open.value = false }
function prev() { show(idx.value - 1) }
function next() { show(idx.value + 1) }

function measureCover(src: string) {
  const id = ++coverMeasureId
  coverAspect.value = null
  if (!import.meta.client || !src) return

  const img = new Image()
  img.onload = () => {
    if (id !== coverMeasureId) return
    const width = img.naturalWidth || img.width
    const height = img.naturalHeight || img.height
    coverAspect.value = width > 0 && height > 0 ? width / height : null
  }
  img.onerror = () => {
    if (id === coverMeasureId) coverAspect.value = null
  }
  img.src = src
}

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

watch(open, (v) => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (import.meta.client) document.body.style.overflow = ''
})
watch(cover, measureCover, { immediate: true })
</script>

<template>
  <article>
    <!-- COMPACT HEADER -->
    <header class="head" :class="`head--${coverOrientation}`" data-chrome-header>
      <div class="head__bg" data-parallax>
        <AppImg :src="cover" :alt="album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="head__img" eager />
      </div>
      <div v-if="coverOrientation !== 'landscape'" class="head__subject" aria-hidden="true">
        <AppImg :src="cover" alt="" sizes="xs:100vw sm:70vw md:38vw lg:420px" class="head__subject-img" eager />
      </div>
      <span v-if="disableNavigation" class="head__back is-disabled" aria-disabled="true">{{ t('albums.coverBack') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="head__back">{{ t('albums.coverBack') }}</NuxtLink>
      <div class="head__body">
        <p class="head__kicker"><span class="head__kicker-category">{{ t('albums.albumKicker', { category: album.category }) }}</span> · <span class="head__kicker-date">{{ album.date }}</span></p>
        <h1 class="head__title" :lang="textLang(album.title)">{{ album.title }}</h1>
        <p class="head__sub" :lang="textLang(album.excerpt)">{{ album.excerpt }}</p>
      </div>
    </header>
    <div class="cut-line" />

    <section class="sheet">
      <div class="sheet__bar">
        <div class="eyebrow"><span class="num">{{ pad(imageCells.length) }}</span> {{ t('albums.framesInThisSetLabel') }}</div>
        <div class="sheet__hint">{{ t('albums.clickToEnlarge') }}</div>
      </div>
      <div class="grid">
        <button
          v-for="(img, i) in imageCells"
          :key="i"
          type="button"
          class="cell"
          :data-row-n="img.row"
          :data-cell-n="img.cell"
          :class="{ 'is-admin-selected': selectedRow === img.row && (selectedCell === img.cell || selectedCell === undefined) }"
          @click="show(i)"
        >
          <AppImg :src="img.src" :alt="img.caption || album.title" sizes="180px" />
          <span v-if="img.caption" class="cell__cap" :lang="textLang(img.caption)">{{ img.caption }}</span>
        </button>
      </div>
    </section>

    <!-- LIGHTBOX -->
    <div v-if="open" class="lb" role="dialog" aria-modal="true" @click.self="close">
      <div class="lb__top">
        <div class="lb__identity">
          <span class="lb__counter"><b>{{ pad(idx + 1) }}</b> / {{ pad(imageCells.length) }}</span>
          <span class="lb__title" :lang="textLang(album.title)">{{ album.title }}</span>
        </div>
        <button class="lb__close" :aria-label="t('albums.close')" @click="close">
          <span>{{ t('albums.close') }}</span>
        </button>
      </div>

      <div class="lb__stage">
        <button class="lb__nav lb__nav--prev" aria-label="Previous image" @click="prev">
          <Icon name="heroicons:chevron-left" />
        </button>
        <figure class="lb__figure">
          <AppImg :src="current!.src" :alt="current!.caption || album.title" class="lb__img" sizes="xs:92vw sm:88vw md:84vw lg:1120px xl:1280px" />
          <figcaption v-if="current!.caption" class="lb__cap" :lang="textLang(current!.caption)">
            <span>{{ pad(idx + 1) }}</span>{{ current!.caption }}
          </figcaption>
        </figure>
        <button class="lb__nav lb__nav--next" aria-label="Next image" @click="next">
          <Icon name="heroicons:chevron-right" />
        </button>
      </div>

      <div class="lb__rail" aria-label="Contact sheet thumbnails">
        <button
          v-for="(img, i) in imageCells"
          :key="`rail-${i}`"
          type="button"
          class="lb__thumb"
          :class="{ 'is-active': i === idx }"
          :aria-label="`Open image ${i + 1}`"
          @click="show(i)"
        >
          <AppImg :src="img.src" :alt="img.caption || album.title" sizes="72px" />
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.head { height: 58svh; background: var(--hero-bg); position: relative; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.head__bg { position: absolute; inset: 0; will-change: transform; }
.head__bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(12, 12, 10, 0.5), rgba(12, 12, 10, 0.9)); }
:deep(.head__img) { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; display: block; }
.head__subject {
  position: absolute;
  z-index: 1;
  top: 5rem;
  right: 3rem;
  bottom: 3rem;
  width: min(34vw, 420px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.head__subject :deep(img) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  box-shadow: 0 1.5rem 4rem rgba(0, 0, 0, 0.3);
}
.head--portrait :deep(.head__img),
.head--square :deep(.head__img) {
  opacity: 0.24;
  filter: blur(20px);
  transform: scale(1.08);
}
.head--portrait .head__bg::after,
.head--square .head__bg::after {
  background:
    linear-gradient(to right, rgba(12, 12, 10, 0.88) 0%, rgba(12, 12, 10, 0.7) 48%, rgba(12, 12, 10, 0.42) 100%),
    linear-gradient(to bottom, rgba(12, 12, 10, 0.5), rgba(12, 12, 10, 0.9));
}
.head__back { position: absolute; top: 6rem; left: 3rem; z-index: 3; font-size: 0.56rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(245, 244, 240, 0.7); text-decoration: none; }
.head__back:hover { color: var(--accent); }
.head__back.is-disabled { cursor: default; pointer-events: none; }
.head__back.is-disabled:hover { color: rgba(245, 244, 240, 0.7); }
.head__body { position: relative; z-index: 2; padding: 0 3rem 3rem; max-width: 1380px; margin: 0 auto; width: 100%; }
.head--portrait .head__body,
.head--square .head__body {
  padding-right: min(42vw, 520px);
}
.head__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.6); margin-bottom: 1.25rem; }
.head__kicker-category, .head__kicker-date { display: inline; }
.head__title { font-family: var(--font-serif); font-size: clamp(3rem, 7vw, 7rem); font-weight: 200; line-height: 0.92; letter-spacing: -0.03em; color: #F5F4F0; white-space: pre-line; overflow-wrap: break-word; }
.head__sub { margin-top: 1.5rem; max-width: 520px; font-size: 0.82rem; color: rgba(245, 244, 240, 0.5); line-height: 1.8; white-space: pre-line; }

.sheet { padding: 4rem 3rem 6rem; max-width: 1380px; margin: 0 auto; }
.sheet__bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem; }
.eyebrow { font-size: 0.54rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 1rem; }
.eyebrow .num { color: var(--accent); font-weight: 500; }
.sheet__hint { font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }

.grid { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 0.65rem; }
.cell { position: relative; overflow: hidden; cursor: zoom-in; background: var(--hero-bg); display: block; border: 1px solid var(--subtle); padding: 0; height: 210px; }
.cell :deep(img) { position: relative; height: 100%; width: auto; max-width: 70vw; display: block; object-fit: contain; transition: opacity 0.18s, transform 0.18s; }
.cell:hover :deep(img) { opacity: 0.82; transform: scale(1.025); }
.cell__cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 1.4rem 0.45rem 0.4rem; background: linear-gradient(transparent, rgba(12, 12, 10, 0.84)); font-size: 0.48rem; letter-spacing: 0.08em; color: rgba(245, 244, 240, 0.85); text-align: left; opacity: 0; transition: opacity 0.18s; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cell:hover .cell__cap { opacity: 1; }

.lb {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  background: color-mix(in srgb, var(--hero-bg) 94%, #000);
  color: #F5F4F0;
}
.lb__top {
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  padding: 1.05rem 1.4rem;
  border-bottom: 1px solid rgba(245, 244, 240, 0.08);
  background: linear-gradient(to bottom, rgba(12, 12, 10, 0.96), rgba(12, 12, 10, 0.72));
}
.lb__identity {
  min-width: 0;
  display: flex;
  align-items: baseline;
  gap: 0.8rem;
}
.lb__counter {
  flex-shrink: 0;
  color: rgba(245, 244, 240, 0.62);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}
.lb__counter b { color: var(--accent); font-weight: 500; }
.lb__title {
  min-width: 0;
  color: rgba(245, 244, 240, 0.86);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lb__close {
  display: inline-flex;
  align-items: center;
  min-height: 1.8rem;
  border: 0;
  background: transparent;
  color: rgba(245, 244, 240, 0.62);
  padding: 0;
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.18s;
}
.lb__close:hover {
  color: var(--accent);
}
.lb__stage {
  position: relative;
  min-height: 0;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
}
.lb__figure {
  min-width: 0;
  min-height: 0;
  height: 100%;
  margin: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  place-items: center;
}
:deep(.lb__img) {
  max-width: 100%;
  max-height: calc(100svh - 12rem);
  width: auto;
  height: auto;
  object-fit: contain;
  box-shadow: 0 2.2rem 6rem rgba(0, 0, 0, 0.42);
}
.lb__nav {
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  border: 1px solid rgba(245, 244, 240, 0.2);
  background: transparent;
  color: rgba(245, 244, 240, 0.7);
  cursor: pointer;
  transition: color 0.18s, border-color 0.18s;
}
.lb__nav:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lb__nav svg { width: 1.2rem; height: 1.2rem; }
.lb__cap {
  width: min(860px, 100%);
  margin-top: 0.9rem;
  color: rgba(245, 244, 240, 0.64);
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  line-height: 1.6;
  text-align: center;
}
.lb__cap span {
  color: var(--accent);
  margin-right: 0.65rem;
  font-size: 0.56rem;
  letter-spacing: 0.16em;
}
.lb__rail {
  display: flex;
  gap: 0.28rem;
  overflow-x: auto;
  padding: 0.62rem 1rem 0.82rem;
  border-top: 1px solid rgba(245, 244, 240, 0.08);
  background: linear-gradient(to top, rgba(12, 12, 10, 0.96), rgba(12, 12, 10, 0.72));
  scrollbar-width: thin;
  scrollbar-color: rgba(245, 244, 240, 0.3) transparent;
}
.lb__thumb {
  position: relative;
  flex: 0 0 4rem;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid rgba(245, 244, 240, 0.1);
  background: rgba(245, 244, 240, 0.04);
  padding: 0;
  cursor: pointer;
}
.lb__thumb :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0.62;
  transition: opacity 0.16s;
}
.lb__thumb:hover :deep(img),
.lb__thumb.is-active :deep(img) {
  opacity: 1;
}
.lb__thumb.is-active {
  border-color: var(--accent);
}
.lb__thumb.is-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  pointer-events: none;
}

@media (max-width: 720px) {
  .head__back { left: 1.5rem; }
  .head__body, .sheet { padding-left: 1.5rem; padding-right: 1.5rem; }
  .head--portrait,
  .head--square {
    height: auto;
    min-height: 76svh;
  }
  .head__subject {
    top: 5rem;
    left: 1.5rem;
    right: 1.5rem;
    bottom: auto;
    width: auto;
    height: 32svh;
  }
  .head--portrait .head__body,
  .head--square .head__body {
    padding-right: 1.5rem;
    padding-top: 38svh;
  }
  .grid { gap: 0.5rem; }
  .cell { height: 130px; }
  .cell :deep(img) { max-width: 85vw; }
  .lb__top {
    align-items: flex-start;
    padding: 0.85rem;
  }
  .lb__identity {
    display: grid;
    gap: 0.25rem;
  }
  .lb__stage {
    grid-template-columns: 1fr;
    padding: 0.75rem;
  }
  .lb__nav {
    position: absolute;
    z-index: 4;
    top: 50%;
    transform: translateY(-50%);
    width: 2.35rem;
    height: 3.8rem;
    background: rgba(12, 12, 10, 0.56);
  }
  .lb__nav--prev { left: 0.75rem; }
  .lb__nav--next { right: 0.75rem; }
  :deep(.lb__img) {
    max-height: calc(100svh - 11rem);
  }
  .lb__thumb {
    flex-basis: 3.45rem;
  }
}
</style>
