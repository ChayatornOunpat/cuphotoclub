<script setup lang="ts">
interface AlbumCell {
  type: string
  span: number
  src?: string
  caption?: string
  content?: string
  align?: 'left' | 'center' | 'right'
  font?: 'serif' | 'sans'
}
interface AlbumRow { cells: AlbumCell[] }
interface Album {
  title: string
  category: string
  date: string
  dateEnd?: string
  location?: string
  excerpt: string
  coverSrc: string
  rows: AlbumRow[]
  textDefaults?: { align?: 'left' | 'center' | 'right', font?: 'serif' | 'sans' }
}
const props = defineProps<{ album: Album, disableNavigation?: boolean, selectedRow?: number, selectedCell?: number, draggableCells?: boolean }>()
const { t } = useI18n()
const localePath = useLocalePath()
const dateDisplay = computed(() => formatAlbumDateRange(props.album.date, props.album.dateEnd))
const { coverOrientation } = useCoverOrientation(() => props.album.coverSrc)

// Sequential image number keyed by "ri-ci"
const imageNumbers = computed(() => {
  const map = new Map<string, number>()
  let n = 1
  for (let ri = 0; ri < props.album.rows.length; ri++) {
    for (let ci = 0; ci < props.album.rows[ri].cells.length; ci++) {
      if (props.album.rows[ri].cells[ci].type === 'image') {
        map.set(`${ri}-${ci}`, n++)
      }
    }
  }
  return map
})

const totalImages = computed(() =>
  props.album.rows.reduce((sum, row) => sum + row.cells.filter(c => c.type === 'image').length, 0)
)

const pad = (n: number) => String(n).padStart(2, '0')

function imgSizes(span: number): string {
  if (span >= 6) return 'xs:100vw sm:100vw md:100vw lg:1380px'
  if (span >= 4) return 'xs:100vw sm:100vw md:65vw lg:920px'
  if (span >= 3) return 'xs:100vw sm:50vw lg:690px'
  return 'xs:100vw sm:33vw lg:460px'
}

function textCellStyle(cell: AlbumCell) {
  const align = cell.align ?? props.album.textDefaults?.align ?? 'left'
  const font = cell.font ?? props.album.textDefaults?.font ?? 'serif'
  return { textAlign: align, fontFamily: font === 'sans' ? 'var(--font-sans)' : 'var(--font-serif)' }
}

const excerptStyle = computed(() => {
  const align = props.album.textDefaults?.align ?? 'left'
  const font = props.album.textDefaults?.font ?? 'serif'
  return { textAlign: align, fontFamily: font === 'sans' ? 'var(--font-sans)' : 'var(--font-serif)' }
})

</script>

<template>
  <article>
    <!-- COVER -->
    <header class="cover" :class="`cover--${coverOrientation}`" data-chrome-header>
      <div class="cover__bg" data-parallax data-hero-dim>
        <AppImg :src="album.coverSrc" :alt="album.title" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="cover__img" eager />
      </div>
      <div v-if="coverOrientation !== 'landscape'" class="cover__subject" aria-hidden="true">
        <AppImg :src="album.coverSrc" alt="" sizes="xs:100vw sm:70vw md:45vw lg:520px" class="cover__subject-img" eager />
      </div>
      <span v-if="disableNavigation" class="cover__back is-disabled" aria-disabled="true">{{ t('albums.coverBack') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="cover__back">{{ t('albums.coverBack') }}</NuxtLink>
      <div class="cover__body">
        <p class="cover__kicker" :lang="textLang(album.category)">{{ t('albums.albumKicker', { category: album.category }) }}</p>
        <h1 class="cover__title" :lang="textLang(album.title)">{{ album.title }}</h1>
        <div class="cover__meta">
          <span>{{ dateDisplay }}</span><span class="dot" />
          <span>{{ t('albums.metaFrames', { count: totalImages }) }}</span>
          <template v-if="album.location"><span class="dot" /><span :lang="textLang(album.location)">{{ album.location }}</span></template>
        </div>
      </div>
    </header>
    <div class="cut-line" />

    <!-- INTRO -->
    <section class="intro">
      <p class="intro__lead" :style="excerptStyle" :lang="textLang(album.excerpt)">{{ album.excerpt }}</p>
    </section>

    <!-- ESSAY FLOW — Lego grid -->
    <section class="essay">
      <div
        v-for="(row, ri) in album.rows"
        :key="ri"
        class="lego-row"
        :data-row-n="ri"
      >
        <template v-for="(cell, ci) in row.cells" :key="ci">

          <!-- IMAGE cell -->
          <figure
            v-if="cell.type === 'image'"
            class="cell cell--image"
            :style="`--span: ${cell.span}`"
            :data-row-n="ri"
            :data-cell-n="ci"
            :draggable="draggableCells ? true : undefined"
            :class="{ 'is-admin-selected': selectedRow === ri && selectedCell === ci }"
          >
            <div class="frame">
              <AppImg :src="cell.src || ''" :alt="cell.caption || album.title" :sizes="imgSizes(cell.span)" />
            </div>
            <figcaption v-if="cell.caption" :lang="textLang(cell.caption)">
              <span class="n">{{ pad(imageNumbers.get(`${ri}-${ci}`) ?? 0) }}</span>
              {{ cell.caption }}
            </figcaption>
          </figure>

          <!-- TEXT cell -->
          <div
            v-else-if="cell.type === 'text'"
            class="cell cell--text"
            :style="`--span: ${cell.span}`"
            :data-row-n="ri"
            :data-cell-n="ci"
            :draggable="draggableCells ? true : undefined"
            :class="{ 'is-admin-selected': selectedRow === ri && selectedCell === ci }"
          >
            <p class="text-block" :style="textCellStyle(cell)" :lang="textLang(cell.content)">{{ cell.content }}</p>
          </div>

          <!-- PAD cell — empty spacer -->
          <div
            v-else
            class="cell cell--pad"
            :style="`--span: ${cell.span}`"
            :data-row-n="ri"
            :data-cell-n="ci"
            :draggable="draggableCells ? true : undefined"
            :class="{ 'is-admin-selected': selectedRow === ri && selectedCell === ci }"
          />

        </template>
      </div>
    </section>

    <!-- ALBUM NAV -->
    <section class="albnav">
      <div class="albnav__inner">
        <span v-if="disableNavigation" class="albnav__back is-disabled" aria-disabled="true">{{ t('albums.allAlbums') }}</span>
        <NuxtLink v-else :to="localePath('/albums')" class="albnav__back">{{ t('albums.allAlbums') }}</NuxtLink>
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
.cover__subject {
  position: absolute;
  z-index: 1;
  top: 7rem;
  right: 8vw;
  bottom: 5rem;
  width: min(36vw, 480px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.cover__subject :deep(img) {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
  box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.28);
}
.cover--portrait :deep(.cover__img),
.cover--square :deep(.cover__img) {
  opacity: 0.28;
  filter: blur(22px);
  transform: scale(1.08);
}
.cover--portrait .cover__bg::after,
.cover--square .cover__bg::after {
  background:
    linear-gradient(to right, rgba(12, 12, 10, 0.88) 0%, rgba(12, 12, 10, 0.72) 46%, rgba(12, 12, 10, 0.42) 100%),
    linear-gradient(to bottom, rgba(12, 12, 10, 0.52) 0%, transparent 34%, rgba(12, 12, 10, 0.88) 100%);
}
.cover--portrait .cover__body,
.cover--square .cover__body {
  padding-right: min(44vw, 580px);
}
.cover__back {
  position: absolute; top: 6rem; left: 3rem; z-index: 3;
  font-size: 0.56rem; letter-spacing: 0.22em; text-transform: uppercase;
  color: rgba(245, 244, 240, 0.7); text-decoration: none; transition: color 0.2s;
}
.cover__back:hover { color: var(--accent); }
.cover__back.is-disabled, .albnav__back.is-disabled { cursor: default; pointer-events: none; }
.cover__back.is-disabled:hover { color: rgba(245, 244, 240, 0.7); }
.albnav__back.is-disabled:hover { color: var(--muted); }
.cover__body { position: relative; z-index: 2; padding: 0 3rem 3.5rem; max-width: 1380px; margin: 0 auto; width: 100%; }
.cover__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.6); margin-bottom: 1.5rem; }
.cover__title { font-family: var(--font-serif); font-size: clamp(3.5rem, 9vw, 9rem); font-weight: 200; line-height: 0.9; letter-spacing: -0.03em; color: #F5F4F0; white-space: pre-line; overflow-wrap: break-word; }
.cover__meta { margin-top: 2rem; display: flex; gap: 1.5rem; align-items: center; font-size: 0.58rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(245, 244, 240, 0.5); }
.cover__meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }

.intro { padding: 6rem 3rem 2rem; max-width: 880px; margin: 0 auto; }
.intro__lead { font-family: var(--font-serif); font-size: clamp(1.6rem, 3vw, 2.6rem); font-weight: 200; line-height: 1.4; letter-spacing: -0.01em; white-space: pre-line; }

.essay { padding: 3rem 3rem 6rem; max-width: 1380px; margin: 0 auto; }

.lego-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1.5rem;
  margin-bottom: 4.5rem;
}
.cell { min-width: 0; }
.cell--image { grid-column: span var(--span); }
.cell--text { grid-column: span var(--span); display: flex; align-items: center; }
.cell--pad  { grid-column: span var(--span); }

figure { margin: 0; }
.frame { overflow: hidden; background: var(--hero-bg); }
.frame :deep(img) { width: 100%; display: block; object-fit: cover; }
figcaption { display: flex; gap: 1rem; align-items: baseline; margin-top: 0.9rem; font-size: 0.6rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
figcaption .n { color: var(--accent); font-weight: 500; flex-shrink: 0; }

.text-block { font-family: var(--font-serif); font-size: clamp(1.1rem, 2vw, 1.4rem); font-weight: 200; line-height: 1.75; color: var(--dark); }

.albnav { background: var(--paper); border-top: 1px solid var(--subtle); border-bottom: 1px solid var(--subtle); padding: 3.5rem 3rem; }
.albnav__inner { max-width: 1380px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; gap: 2rem; flex-wrap: wrap; }
.albnav__back { font-size: 0.58rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted); text-decoration: none; transition: color 0.2s; }
.albnav__back:hover { color: var(--accent); }

@media (max-width: 1000px) {
  /* Collapse the 6-col Lego grid to 3 columns so span-1/2 images don't render
     as tiny slivers on tablets and landscape phones. Grid clamps larger spans
     (3/4/6) down to the available track count automatically. */
  .lego-row { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 3.5rem; }
  .intro { padding-top: 4.5rem; }
}

@media (max-width: 720px) {
  .cover__back { left: 1.5rem; }
  .cover__body { padding: 0 1.5rem 2.5rem; }
  .cover__subject {
    top: 5.5rem;
    left: 1.5rem;
    right: 1.5rem;
    bottom: auto;
    width: auto;
    height: 42svh;
  }
  .cover--portrait .cover__body,
  .cover--square .cover__body {
    padding-right: 1.5rem;
  }
  .cover--portrait .cover__title,
  .cover--square .cover__title {
    font-size: clamp(2.8rem, 17vw, 5rem);
  }
  .intro, .essay, .albnav { padding-left: 1.5rem; padding-right: 1.5rem; }
  /* Reclaim vertical space: full-viewport cover + 6rem intro + 4.5rem row gaps
     forces a lot of scrolling on phones. */
  .intro { padding-top: 3rem; padding-bottom: 1.5rem; }
  .essay { padding-top: 2rem; padding-bottom: 4rem; }
  .lego-row { grid-template-columns: 1fr; gap: 1rem; margin-bottom: 2.5rem; }
  .cell--image, .cell--text { grid-column: 1 / -1; }
}
</style>
