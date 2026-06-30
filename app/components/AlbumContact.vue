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
  idx.value = (i + imageCells.value.length) % imageCells.value.length
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
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  if (import.meta.client) document.body.style.overflow = ''
})
</script>

<template>
  <article>
    <!-- COMPACT HEADER -->
    <header class="head" data-chrome-header>
      <div class="head__bg" data-parallax>
        <AppImg :src="cover" :alt="album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="head__img" eager />
      </div>
      <span v-if="disableNavigation" class="head__back is-disabled" aria-disabled="true">{{ t('albums.coverBack') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="head__back">{{ t('albums.coverBack') }}</NuxtLink>
      <div class="head__body">
        <p class="head__kicker">{{ t('albums.albumKicker', { category: album.category }) }} · {{ album.date }}</p>
        <h1 class="head__title">{{ album.title }}</h1>
        <p class="head__sub">{{ album.excerpt }}</p>
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
          class="cell"
          :data-row-n="img.row"
          :data-cell-n="img.cell"
          :class="{ 'is-admin-selected': selectedRow === img.row && (selectedCell === img.cell || selectedCell === undefined) }"
          @click="show(i)"
        >
          <span class="cell__num">{{ pad(i + 1) }}</span>
          <AppImg :src="img.src" :alt="img.caption || album.title" sizes="sm:50vw lg:460px" />
          <span v-if="img.caption" class="cell__cap">{{ img.caption }}</span>
        </button>
      </div>
    </section>

    <!-- LIGHTBOX -->
    <div v-if="open" class="lb open" @click.self="close">
      <div class="lb__top">
        <span class="lb__counter"><b>{{ pad(idx + 1) }}</b> / {{ pad(imageCells.length) }} · {{ album.title }}</span>
        <button class="lb__close" @click="close">{{ t('albums.close') }}</button>
      </div>
      <div class="lb__stage">
        <button class="lb__nav" @click="prev">‹</button>
        <AppImg :src="current!.src" :alt="current!.caption || album.title" class="lb__img" sizes="xs:90vw sm:86vw md:86vw lg:1100px xl:1100px" />
        <button class="lb__nav" @click="next">›</button>
      </div>
      <div class="lb__cap"><span>{{ pad(idx + 1) }}</span>{{ current!.caption }}</div>
    </div>
  </article>
</template>

<style scoped>
.head { min-height: 58svh; background: var(--hero-bg); position: relative; display: flex; flex-direction: column; justify-content: flex-end; overflow: hidden; }
.head__bg { position: absolute; inset: 0; will-change: transform; }
.head__bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(12, 12, 10, 0.5), rgba(12, 12, 10, 0.9)); }
:deep(.head__img) { width: 100%; height: 100%; object-fit: cover; opacity: 0.4; display: block; }
.head__back { position: absolute; top: 6rem; left: 3rem; z-index: 3; font-size: 0.56rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(245, 244, 240, 0.7); text-decoration: none; }
.head__back:hover { color: var(--accent); }
.head__back.is-disabled { cursor: default; pointer-events: none; }
.head__back.is-disabled:hover { color: rgba(245, 244, 240, 0.7); }
.head__body { position: relative; z-index: 2; padding: 0 3rem 3rem; max-width: 1380px; margin: 0 auto; width: 100%; }
.head__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.6); margin-bottom: 1.25rem; }
.head__title { font-family: var(--font-serif); font-size: clamp(3rem, 7vw, 7rem); font-weight: 200; line-height: 0.92; letter-spacing: -0.03em; color: #F5F4F0; }
.head__sub { margin-top: 1.5rem; max-width: 520px; font-size: 0.82rem; color: rgba(245, 244, 240, 0.5); line-height: 1.8; }

.sheet { padding: 4rem 3rem 6rem; max-width: 1380px; margin: 0 auto; }
.sheet__bar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; flex-wrap: wrap; gap: 1rem; }
.eyebrow { font-size: 0.54rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 1rem; }
.eyebrow .num { color: var(--accent); font-weight: 500; }
.sheet__hint { font-size: 0.54rem; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted); }

.grid { column-count: 3; column-gap: 1rem; }
.cell { break-inside: avoid; margin-bottom: 1rem; position: relative; overflow: hidden; cursor: zoom-in; background: var(--hero-bg); display: block; border: none; padding: 0; width: 100%; }
.cell :deep(img) { width: 100%; display: block; object-fit: cover; transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.cell:hover :deep(img) { transform: scale(1.04); }
.cell__num { position: absolute; top: 0.7rem; left: 0.7rem; font-size: 0.5rem; letter-spacing: 0.16em; color: #F5F4F0; background: rgba(12, 12, 10, 0.5); backdrop-filter: blur(4px); padding: 0.35rem 0.55rem; opacity: 0.8; transition: background 0.25s; }
.cell:hover .cell__num { background: var(--accent); opacity: 1; }
.cell__cap { position: absolute; left: 0; right: 0; bottom: 0; padding: 2rem 0.8rem 0.7rem; background: linear-gradient(transparent, rgba(12, 12, 10, 0.8)); font-size: 0.56rem; letter-spacing: 0.1em; color: rgba(245, 244, 240, 0.85); text-align: left; opacity: 0; transition: opacity 0.28s; }
.cell:hover .cell__cap { opacity: 1; }

.lb { position: fixed; inset: 0; z-index: 300; background: rgba(10, 10, 8, 0.97); display: flex; flex-direction: column; }
.lb__top { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem 2rem; color: rgba(245, 244, 240, 0.7); }
.lb__counter { font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; }
.lb__counter b { color: var(--accent); font-weight: 500; }
.lb__close { background: none; border: none; color: rgba(245, 244, 240, 0.7); font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; cursor: pointer; transition: color 0.2s; }
.lb__close:hover { color: var(--accent); }
.lb__stage { flex: 1; display: flex; align-items: center; justify-content: center; gap: 1.5rem; padding: 0 2rem; position: relative; }
:deep(.lb__img) { max-width: min(1100px, 86vw); max-height: 78vh; object-fit: contain; box-shadow: 0 30px 80px rgba(0, 0, 0, 0.5); }
.lb__nav { background: none; border: 1px solid rgba(245, 244, 240, 0.2); color: #F5F4F0; width: 48px; height: 48px; border-radius: 50%; cursor: pointer; font-size: 1.1rem; flex-shrink: 0; transition: background 0.2s, border-color 0.2s; }
.lb__nav:hover { background: var(--accent); border-color: var(--accent); }
.lb__cap { text-align: center; padding: 1.25rem 2rem 2rem; color: rgba(245, 244, 240, 0.55); font-size: 0.68rem; letter-spacing: 0.12em; }
.lb__cap span { color: var(--accent); margin-right: 0.75rem; }

@media (max-width: 880px) { .grid { column-count: 2; } }
@media (max-width: 720px) {
  .head__back { left: 1.5rem; }
  .head__body, .sheet { padding-left: 1.5rem; padding-right: 1.5rem; }
  .grid { column-count: 1; }
}
</style>
