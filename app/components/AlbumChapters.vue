<script setup lang="ts">
interface AlbumCell { type: string, span: number, src?: string, caption?: string, content?: string }
interface AlbumRow { cells: AlbumCell[] }
interface Album {
  title: string
  category: string
  date: string
  dateEnd?: string
  excerpt: string
  coverSrc: string
  rows: AlbumRow[]
}
const props = defineProps<{ album: Album, disableNavigation?: boolean, selectedRow?: number, selectedCell?: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const cover = computed(() => props.album.coverSrc)
const dateDisplay = computed(() => formatAlbumDateRange(props.album.date, props.album.dateEnd))
const { coverOrientation } = useCoverOrientation(() => cover.value)

// ── Chapters: each text cell starts a new chapter titled by its content; the
// images that follow belong to it. Albums without text cells render as one
// untitled chapter (plain justified flow). The first photo of a titled chapter
// with enough frames runs full-width as its opening plate.
interface ChapterImage { src: string, caption?: string, n: number, row: number, cell: number }
interface Chapter {
  title?: string
  row?: number
  cell?: number
  images: ChapterImage[]
  plate?: ChapterImage
  grid: ChapterImage[]
  start: number
  end: number
}

const chapters = computed<Chapter[]>(() => {
  const out: Chapter[] = []
  let current: Chapter = { images: [], grid: [], start: 1, end: 0 }
  let n = 0

  const flush = () => {
    if (!current.images.length && !current.title) return
    out.push(current)
  }

  for (let ri = 0; ri < props.album.rows.length; ri++) {
    for (let ci = 0; ci < props.album.rows[ri]!.cells.length; ci++) {
      const cell = props.album.rows[ri]!.cells[ci]!
      if (cell.type === 'text' && cell.content?.trim()) {
        flush()
        current = { title: cell.content.trim(), row: ri, cell: ci, images: [], grid: [], start: n + 1, end: n }
      } else if (cell.type === 'image') {
        current.images.push({ src: cell.src ?? '', caption: cell.caption, n: ++n, row: ri, cell: ci })
      }
    }
  }
  flush()

  for (const ch of out) {
    ch.start = ch.images[0]?.n ?? 0
    ch.end = ch.images[ch.images.length - 1]?.n ?? 0
    const withPlate = !!ch.title && ch.images.length >= 4
    ch.plate = withPlate ? ch.images[0] : undefined
    ch.grid = withPlate ? ch.images.slice(1) : ch.images
  }
  return out
})

const allImages = computed(() => chapters.value.flatMap(ch => ch.images))
const totalImages = computed(() => allImages.value.length)
const titledChapters = computed(() => chapters.value.filter(ch => ch.title))
const showChapterNav = computed(() => titledChapters.value.length >= 2)

const pad = (n: number) => String(n).padStart(totalImages.value > 99 ? 3 : 2, '0')

// ── Live frame counter + active chapter ──
const rootEl = ref<HTMLElement | null>(null)
const currentFrame = ref(1)
const activeChapter = ref(0)
let scrollRaf = 0

function trackScroll() {
  scrollRaf = 0
  const root = rootEl.value
  if (!root) return
  const fold = window.innerHeight * 0.7
  let frame = 1
  root.querySelectorAll<HTMLElement>('[data-frame-n]').forEach((el) => {
    if (el.getBoundingClientRect().top < fold) frame = Math.max(frame, Number(el.dataset.frameN))
  })
  currentFrame.value = frame
  let active = 0
  root.querySelectorAll<HTMLElement>('[data-chapter-i]').forEach((el) => {
    if (el.getBoundingClientRect().top < window.innerHeight * 0.4) active = Number(el.dataset.chapterI)
  })
  activeChapter.value = active
}
function onScroll() {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(trackScroll)
}

function jumpTo(i: number) {
  rootEl.value?.querySelector<HTMLElement>(`[data-chapter-i="${i}"]`)?.scrollIntoView({ behavior: 'smooth' })
}

// ── Lightbox ──
const open = ref(false)
const idx = ref(0)
const lightboxRef = ref<HTMLElement | null>(null)
const current = computed(() => allImages.value[idx.value])
useFocusTrap(lightboxRef, open)

function show(i: number) {
  if (props.disableNavigation) return
  idx.value = (i + allImages.value.length) % allImages.value.length
  open.value = true
}
function close() { open.value = false }
function prev() { show(idx.value - 1) }
function next() { show(idx.value + 1) }

function onKey(e: KeyboardEvent) {
  if (!open.value) return
  if (e.key === 'Escape') close()
  if (e.key === 'ArrowLeft') prev()
  if (e.key === 'ArrowRight') next()
}

watch(open, (v) => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('scroll', onScroll, { passive: true })
  trackScroll()
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('scroll', onScroll)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <article ref="rootEl">
    <!-- COMPACT HEADER -->
    <header class="head" :class="`head--${coverOrientation}`" data-chrome-header>
      <div class="head__bg" data-parallax data-hero-dim>
        <AppImg :src="cover" :alt="album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="head__img" eager />
      </div>
      <div v-if="coverOrientation !== 'landscape'" class="head__subject" aria-hidden="true">
        <AppImg :src="cover" alt="" sizes="xs:100vw sm:70vw md:38vw lg:420px" class="head__subject-img" eager />
      </div>
      <span v-if="disableNavigation" class="head__back is-disabled" aria-disabled="true">{{ t('albums.coverBack') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="head__back">{{ t('albums.coverBack') }}</NuxtLink>
      <div class="head__body">
        <p class="head__kicker"><span :lang="textLang(album.category)">{{ t('albums.albumKicker', { category: album.category }) }}</span> · <span>{{ dateDisplay }}</span> · <span>{{ t('albums.metaFrames', { count: totalImages }) }}</span></p>
        <h1 class="head__title" :lang="textLang(album.title)">{{ album.title }}</h1>
        <p class="head__sub" :lang="textLang(album.excerpt)">{{ album.excerpt }}</p>
      </div>
    </header>
    <div class="cut-line" />

    <!-- STICKY CHAPTER INDEX -->
    <nav class="chbar" :aria-label="t('albums.chaptersLabel')">
      <span class="chbar__counter"><b>{{ pad(currentFrame) }}</b> / {{ pad(totalImages) }}</span>
      <div v-if="showChapterNav" class="chbar__links">
        <button
          v-for="(ch, i) in chapters"
          :key="i"
          v-show="ch.title"
          type="button"
          class="chbar__link"
          :class="{ 'is-active': activeChapter === i }"
          @click="jumpTo(i)"
        >
          <span class="n">{{ String(i + 1).padStart(2, '0') }}</span>
          <span :lang="textLang(ch.title!)">{{ ch.title }}</span>
        </button>
      </div>
      <span class="chbar__hint">{{ t('albums.clickToEnlarge') }}</span>
    </nav>

    <!-- CHAPTERS -->
    <section class="body">
      <section
        v-for="(ch, i) in chapters"
        :key="i"
        class="chapter"
        :data-chapter-i="i"
      >
        <template v-if="ch.title">
          <div
            class="chapter__head"
            :data-row-n="ch.row"
            :data-cell-n="ch.cell"
            :class="{ 'is-admin-selected': selectedRow === ch.row && (selectedCell === ch.cell || selectedCell === undefined) }"
          >
            <span class="chapter__num">{{ String(i + 1).padStart(2, '0') }}</span>
            <h2 class="chapter__title" :lang="textLang(ch.title)">{{ ch.title }}</h2>
            <span v-if="ch.images.length" class="chapter__range">{{ t('albums.frameRange', { from: pad(ch.start), to: pad(ch.end) }) }}</span>
          </div>
          <div class="chapter__rule" />
        </template>

        <button
          v-if="ch.plate"
          type="button"
          class="plate"
          :data-frame-n="ch.plate.n"
          :data-row-n="ch.plate.row"
          :data-cell-n="ch.plate.cell"
          :class="{ 'is-admin-selected': selectedRow === ch.plate.row && (selectedCell === ch.plate.cell || selectedCell === undefined) }"
          @click="show(ch.plate.n - 1)"
        >
          <AppImg :src="ch.plate.src" :alt="ch.plate.caption || album.title" sizes="xs:100vw sm:100vw lg:1330px" :eager="i === 0" />
          <span class="plate__cap" :lang="ch.plate.caption ? textLang(ch.plate.caption) : undefined">
            {{ pad(ch.plate.n) }}<template v-if="ch.plate.caption"> · {{ ch.plate.caption }}</template>
          </span>
        </button>

        <!-- Justified flow: cells take their image's natural width at fixed row
             height, then flex-grow shares each row's leftover so rows run edge
             to edge (slight cover-crop absorbs the stretch). The ::after spacer
             keeps the final row from ballooning. -->
        <div class="jgrid">
          <button
            v-for="img in ch.grid"
            :key="img.n"
            type="button"
            class="jcell"
            :data-frame-n="img.n"
            :data-row-n="img.row"
            :data-cell-n="img.cell"
            :class="{ 'is-admin-selected': selectedRow === img.row && (selectedCell === img.cell || selectedCell === undefined) }"
            @click="show(img.n - 1)"
          >
            <AppImg :src="img.src" :alt="img.caption || album.title" sizes="360px" />
            <span class="jcell__n">{{ pad(img.n) }}</span>
            <span v-if="img.caption" class="jcell__cap" :lang="textLang(img.caption)">{{ img.caption }}</span>
          </button>
        </div>
      </section>

      <footer class="exit">
        <span v-if="disableNavigation" class="exit__back is-disabled" aria-disabled="true">{{ t('albums.allAlbums') }}</span>
        <NuxtLink v-else :to="localePath('/albums')" class="exit__back">{{ t('albums.allAlbums') }}</NuxtLink>
        <span class="exit__meta">{{ t('albums.metaFrames', { count: totalImages }) }}</span>
      </footer>
    </section>

    <!-- LIGHTBOX -->
    <div v-if="open" ref="lightboxRef" class="lb" role="dialog" aria-modal="true" @click.self="close">
      <div class="lb__top">
        <div class="lb__identity">
          <span class="lb__counter"><b>{{ pad(idx + 1) }}</b> / {{ pad(totalImages) }}</span>
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

      <div class="lb__rail" aria-label="Thumbnails">
        <button
          v-for="(img, i) in allImages"
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
/* ── Compact header (same treatment as the contact sheet) ── */
.head { min-height: 58svh; background: var(--hero-bg); position: relative; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
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
.head__body { position: relative; z-index: 2; padding: 8.5rem 3rem 3rem; max-width: 1380px; margin: 0 auto; width: 100%; }
.head--portrait .head__body,
.head--square .head__body {
  padding-right: min(42vw, 520px);
}
.head__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.6); margin-bottom: 1.25rem; }
.head__title { font-family: var(--font-serif); font-size: clamp(3rem, 7vw, 7rem); font-weight: 200; line-height: 0.92; letter-spacing: -0.03em; color: #F5F4F0; white-space: pre-line; overflow-wrap: break-word; }
.head__sub { margin-top: 1.5rem; max-width: 520px; font-size: 0.82rem; color: rgba(245, 244, 240, 0.5); line-height: 1.8; white-space: pre-line; }
.cut-line { height: 2px; background: var(--accent); }

/* ── Sticky chapter index (top clears the fixed site nav, ~3.9rem tall) ── */
.chbar {
  position: sticky;
  top: 3.8rem;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 1.6rem;
  padding: 0 3rem;
  height: 3.1rem;
  background: color-mix(in srgb, var(--body-bg) 92%, transparent);
  backdrop-filter: blur(6px);
  border-bottom: 1px solid var(--subtle);
}
.chbar__counter { font-size: 0.56rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); flex-shrink: 0; }
.chbar__counter b { color: var(--accent); font-weight: 500; }
.chbar__links { display: flex; gap: 1.4rem; overflow-x: auto; scrollbar-width: none; }
.chbar__links::-webkit-scrollbar { display: none; }
.chbar__link {
  flex-shrink: 0;
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
  background: none;
  border: 0;
  border-bottom: 1px solid transparent;
  padding: 0.35rem 0;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.chbar__link .n { color: var(--subtle); transition: color 0.15s; }
.chbar__link:hover { color: var(--dark); }
.chbar__link.is-active { color: var(--dark); border-color: var(--accent); }
.chbar__link.is-active .n { color: var(--accent); }
.chbar__hint { margin-left: auto; flex-shrink: 0; font-size: 0.5rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }

/* ── Chapters ── */
.body { max-width: 1380px; margin: 0 auto; padding: 0 1.5rem 6rem; }
.chapter { padding-top: 4.5rem; scroll-margin-top: 8rem; }
.chapter:first-of-type { padding-top: 3rem; }
.chapter__head { display: flex; align-items: baseline; gap: 1.25rem; margin-bottom: 0.9rem; padding: 0 0.15rem; }
.chapter__num { font-size: 0.56rem; letter-spacing: 0.24em; color: var(--accent); font-weight: 500; }
.chapter__title { font-family: var(--font-serif); font-size: clamp(1.5rem, 2.6vw, 2.2rem); font-weight: 200; color: var(--dark); white-space: pre-line; }
.chapter__range { margin-left: auto; flex-shrink: 0; font-size: 0.52rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); }
.chapter__rule { height: 1px; background: var(--subtle); margin-bottom: 1.4rem; }

/* Opening plate */
.plate { position: relative; display: block; width: 100%; margin-bottom: 0.6rem; background: var(--hero-bg); border: 0; padding: 0; cursor: zoom-in; }
.plate :deep(img) { width: 100%; max-height: 72vh; object-fit: cover; display: block; }
.plate__cap {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 2.4rem 1.4rem 0.9rem;
  background: linear-gradient(transparent, rgba(12, 12, 10, 0.72));
  color: rgba(245, 244, 240, 0.85);
  font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; text-align: left;
}

/* Justified flow */
.jgrid { display: flex; flex-wrap: wrap; gap: 0.55rem; }
.jgrid::after { content: ''; flex-grow: 1000; }
.jcell {
  position: relative;
  height: 215px;
  max-width: 100%;
  min-width: 0;
  flex-grow: 1;
  overflow: hidden;
  background: var(--paper);
  border: 0;
  padding: 0;
  cursor: zoom-in;
}
.jcell :deep(img) {
  height: 100%;
  width: auto;
  min-width: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.18s, transform 0.25s ease-out;
}
.jcell:hover :deep(img) { opacity: 0.85; transform: scale(1.02); }
.jcell__n {
  position: absolute; top: 0.4rem; left: 0.45rem;
  font-size: 0.48rem; letter-spacing: 0.14em;
  color: #F5F4F0; background: rgba(12, 12, 10, 0.55);
  padding: 0.18rem 0.34rem;
  opacity: 0; transition: opacity 0.15s;
}
.jcell:hover .jcell__n { opacity: 1; }
.jcell__cap {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 1.4rem 0.45rem 0.4rem;
  background: linear-gradient(transparent, rgba(12, 12, 10, 0.84));
  font-size: 0.48rem; letter-spacing: 0.08em; color: rgba(245, 244, 240, 0.85);
  text-align: left; opacity: 0; transition: opacity 0.15s;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.jcell:hover .jcell__cap { opacity: 1; }

/* Admin preview selection */
.is-admin-selected { outline: 2px solid var(--accent); outline-offset: 3px; }

/* ── Exit ── */
.exit { border-top: 1px solid var(--subtle); margin-top: 4rem; padding: 2.6rem 0.15rem 0; display: flex; justify-content: space-between; align-items: baseline; }
.exit__back { font-size: 0.56rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--dark); text-decoration: none; border-bottom: 1px solid var(--accent); padding-bottom: 0.2rem; }
.exit__back:hover { color: var(--accent); }
.exit__back.is-disabled { cursor: default; pointer-events: none; }
.exit__meta { font-size: 0.52rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }

/* ── Lightbox (same treatment as the contact sheet) ── */
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
.lb__close:hover { color: var(--accent); }
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
.lb__thumb.is-active :deep(img) { opacity: 1; }
.lb__thumb.is-active { border-color: var(--accent); }
.lb__thumb.is-active::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2px solid var(--accent);
  pointer-events: none;
}

@media (max-width: 720px) {
  .head__back { left: 1.5rem; }
  .head__body { padding-left: 1.5rem; padding-right: 1.5rem; }
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

  .chbar { top: 3.6rem; padding: 0 1.25rem; gap: 1rem; }
  .chbar__hint { display: none; }

  .body { padding: 0 0.6rem 4rem; }
  .chapter { padding-top: 3rem; scroll-margin-top: 7rem; }
  .chapter__head { padding: 0 0.65rem; flex-wrap: wrap; gap: 0.5rem 1rem; }
  .chapter__rule { margin-left: 0.65rem; margin-right: 0.65rem; }
  .jcell { height: 150px; }
  .exit { margin-left: 0.65rem; margin-right: 0.65rem; }

  .lb__top { align-items: flex-start; padding: 0.85rem; }
  .lb__identity { display: grid; gap: 0.25rem; }
  .lb__stage { grid-template-columns: 1fr; padding: 0.75rem; }
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
  :deep(.lb__img) { max-height: calc(100svh - 11rem); }
  .lb__thumb { flex-basis: 3.45rem; }
}
</style>
