<script setup lang="ts">
interface AlbumCell { type: string, span: number, src?: string, caption?: string, content?: string }
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
}
const props = defineProps<{ album: Album, disableNavigation?: boolean, selectedRow?: number, selectedCell?: number }>()
const { t } = useI18n()
const localePath = useLocalePath()
const dateDisplay = computed(() => formatAlbumDateRange(props.album.date, props.album.dateEnd))

// Flatten rows/cells in canvas order, keeping row/cell coordinates for the
// admin preview selection and the cell span for print sizing.
interface PlateItem { kind: 'image', src: string, caption?: string, span: number, n: number, row: number, cell: number }
interface NoteItem { kind: 'text', content: string, row: number, cell: number }
interface SpacerItem { kind: 'spacer', row: number, cell: number }
const sequence = computed<(PlateItem | NoteItem | SpacerItem)[]>(() => {
  const out: (PlateItem | NoteItem | SpacerItem)[] = []
  let n = 0
  for (let ri = 0; ri < props.album.rows.length; ri++) {
    for (let ci = 0; ci < props.album.rows[ri]!.cells.length; ci++) {
      const cell = props.album.rows[ri]!.cells[ci]!
      if (cell.type === 'image') {
        out.push({ kind: 'image', src: cell.src ?? '', caption: cell.caption, span: cell.span, n: ++n, row: ri, cell: ci })
      } else if (cell.type === 'text' && cell.content?.trim()) {
        out.push({ kind: 'text', content: cell.content, row: ri, cell: ci })
      } else if (cell.type === 'pad') {
        out.push({ kind: 'spacer', row: ri, cell: ci })
      }
    }
  }
  return out
})

const totalImages = computed(() => sequence.value.filter(item => item.kind === 'image').length)
const pad = (n: number) => String(n).padStart(2, '0')

// The canvas span (2/3/4/6 of 6 columns) decides how large the print hangs.
function plateWidth(span: number) {
  if (span >= 6) return 'min(100%, 1100px)'
  if (span >= 4) return 'min(100%, 820px)'
  if (span >= 3) return 'min(100%, 640px)'
  return 'min(100%, 460px)'
}

function plateSizes(span: number) {
  if (span >= 6) return 'xs:100vw sm:100vw lg:1100px'
  if (span >= 4) return 'xs:100vw sm:80vw lg:820px'
  if (span >= 3) return 'xs:100vw sm:65vw lg:640px'
  return 'xs:100vw sm:50vw lg:460px'
}
</script>

<template>
  <!-- data-chrome-header on the whole article: the page never scrolls past a
       dark region, so the site nav keeps its over-dark treatment throughout. -->
  <article class="dk" data-chrome-header>

    <!-- ENTRY WALL -->
    <header class="dk-head">
      <span v-if="disableNavigation" class="dk-head__back is-disabled" aria-disabled="true">{{ t('albums.coverBack') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="dk-head__back">{{ t('albums.coverBack') }}</NuxtLink>

      <p class="dk-head__kicker" :lang="textLang(album.category)">{{ t('albums.albumKicker', { category: album.category }) }}</p>
      <h1 class="dk-head__title" :lang="textLang(album.title)">{{ album.title }}</h1>
      <p v-if="album.excerpt" class="dk-head__excerpt" :lang="textLang(album.excerpt)">{{ album.excerpt }}</p>
      <div class="dk-head__meta">
        <span>{{ dateDisplay }}</span><span class="dot" />
        <span>{{ t('albums.metaFrames', { count: totalImages }) }}</span>
        <template v-if="album.location"><span class="dot" /><span :lang="textLang(album.location)">{{ album.location }}</span></template>
      </div>

      <div v-if="album.coverSrc" class="dk-head__print">
        <AppImg :src="album.coverSrc" :alt="album.title" sizes="xs:100vw sm:70vw lg:720px" eager optimize />
      </div>
      <div class="dk-head__scroll" aria-hidden="true" />
    </header>

    <!-- PRINTS -->
    <section class="dk-flow">
      <template v-for="item in sequence" :key="`${item.row}-${item.cell}`">

        <figure
          v-if="item.kind === 'image'"
          class="dk-plate"
          :style="{ '--w': plateWidth(item.span) }"
          :data-row-n="item.row"
          :data-cell-n="item.cell"
          :class="{ 'is-admin-selected': selectedRow === item.row && (selectedCell === item.cell || selectedCell === undefined) }"
        >
          <div class="dk-plate__print">
            <AppImg :src="item.src" :alt="item.caption || album.title" :sizes="plateSizes(item.span)" />
          </div>
          <figcaption class="dk-plate__caption">
            <span class="n">{{ pad(item.n) }} / {{ pad(totalImages) }}</span>
            <span v-if="item.caption" :lang="textLang(item.caption)">{{ item.caption }}</span>
          </figcaption>
        </figure>

        <div
          v-else-if="item.kind === 'text'"
          class="dk-note"
          :data-row-n="item.row"
          :data-cell-n="item.cell"
          :class="{ 'is-admin-selected': selectedRow === item.row && (selectedCell === item.cell || selectedCell === undefined) }"
        >
          <p :lang="textLang(item.content)">{{ item.content }}</p>
        </div>

        <div
          v-else
          class="dk-spacer"
          :data-row-n="item.row"
          :data-cell-n="item.cell"
          :class="{ 'is-admin-selected': selectedRow === item.row && (selectedCell === item.cell || selectedCell === undefined) }"
        />

      </template>
    </section>

    <!-- EXIT -->
    <footer class="dk-exit">
      <span v-if="disableNavigation" class="dk-exit__back is-disabled" aria-disabled="true">{{ t('albums.allAlbums') }}</span>
      <NuxtLink v-else :to="localePath('/albums')" class="dk-exit__back">{{ t('albums.allAlbums') }}</NuxtLink>
    </footer>
  </article>
</template>

<style scoped>
.dk {
  --dk-bg: #0C0C0A;
  --dk-ink: #F5F4F0;
  --dk-dim: rgba(245, 244, 240, 0.55);
  --dk-faint: rgba(245, 244, 240, 0.32);
  --dk-line: rgba(245, 244, 240, 0.14);
  background: var(--dk-bg);
  color: var(--dk-ink);
}

/* ── Entry wall ── */
.dk-head {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100svh;
  padding: 9rem 1.5rem 4.5rem;
  text-align: center;
}

.dk-head__back {
  position: absolute;
  top: 6rem;
  left: 3rem;
  font-size: 0.56rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--dk-dim);
  text-decoration: none;
  transition: color 0.2s;
}
.dk-head__back:hover { color: var(--accent); }
.dk-head__back.is-disabled, .dk-exit__back.is-disabled { cursor: default; pointer-events: none; }

.dk-head__kicker {
  font-size: 0.56rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.75rem;
}

.dk-head__title {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7vw, 6.5rem);
  font-weight: 200;
  line-height: 0.95;
  letter-spacing: -0.02em;
  white-space: pre-line;
  overflow-wrap: break-word;
  max-width: 18ch;
}

.dk-head__excerpt {
  margin-top: 1.75rem;
  max-width: 34rem;
  font-family: var(--font-serif);
  font-size: clamp(0.95rem, 1.6vw, 1.15rem);
  font-weight: 300;
  line-height: 1.8;
  color: var(--dk-dim);
  white-space: pre-line;
}

.dk-head__meta {
  margin-top: 2rem;
  display: flex;
  gap: 1.5rem;
  align-items: center;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dk-faint);
}
.dk-head__meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }

.dk-head__print {
  margin-top: 3.5rem;
  width: min(100%, 720px);
}
.dk-head__print :deep(img) {
  width: 100%;
  max-height: 62svh;
  object-fit: contain;
  display: block;
  box-shadow: 0 2.5rem 6rem rgba(0, 0, 0, 0.65);
}

.dk-head__scroll {
  width: 1px;
  height: 3.5rem;
  margin-top: 3rem;
  background: linear-gradient(var(--accent), transparent);
}

/* ── Prints ── */
.dk-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 7rem;
  padding: 5rem 1.5rem 8rem;
}

.dk-plate {
  margin: 0;
  width: var(--w, 100%);
}
.dk-plate__print :deep(img) {
  width: 100%;
  max-height: 84svh;
  object-fit: contain;
  display: block;
  background: var(--dk-bg);
  box-shadow: 0 2rem 5rem rgba(0, 0, 0, 0.6);
}
.dk-plate__caption {
  display: flex;
  gap: 1.1rem;
  align-items: baseline;
  justify-content: center;
  margin-top: 1.1rem;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dk-dim);
}
.dk-plate__caption .n { color: var(--accent); font-weight: 500; flex-shrink: 0; }

.dk-note {
  max-width: 32rem;
  padding: 0 1rem;
  text-align: center;
}
.dk-note p {
  font-family: var(--font-serif);
  font-size: clamp(1.05rem, 1.9vw, 1.35rem);
  font-weight: 200;
  line-height: 1.85;
  color: var(--dk-dim);
  white-space: pre-line;
}

/* Extra pause on top of .dk-flow's own 7rem gap — a deliberate breath in the
   hanging-prints sequence. */
.dk-spacer { width: 100%; height: 4rem; }

/* Admin preview selection */
.is-admin-selected { outline: 2px solid var(--accent); outline-offset: 4px; }

/* ── Exit ── */
.dk-exit {
  border-top: 1px solid var(--dk-line);
  padding: 3.5rem 3rem;
  text-align: center;
}
.dk-exit__back {
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--dk-dim);
  text-decoration: none;
  transition: color 0.2s;
}
.dk-exit__back:hover { color: var(--accent); }
.dk-exit__back.is-disabled:hover { color: var(--dk-dim); }

@media (max-width: 720px) {
  .dk-head { padding: 7rem 1.25rem 3.5rem; }
  .dk-head__back { left: 1.5rem; top: 5.5rem; }
  .dk-flow { gap: 4.5rem; padding: 3.5rem 1.25rem 6rem; }
  .dk-spacer { height: 2.5rem; }
  /* Keep each hanging print scannable — 84svh means a portrait image fills the
     screen and demands a full swipe per photo. */
  .dk-plate__print :deep(img) { max-height: 72svh; }
  .dk-head__print :deep(img) { max-height: 54svh; }
}
</style>
