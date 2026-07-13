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
const cover = computed(() => props.album.coverSrc)
const categoryAlbumsPath = computed(() => `${localePath('/albums')}?category=${encodeURIComponent(props.album.category)}`)
const dateDisplay = computed(() => formatAlbumDateRange(props.album.date, props.album.dateEnd))

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

// ── Live frame counter (same rAF scroll tracking as AlbumChapters) ──
const rootEl = ref<HTMLElement | null>(null)
const currentFrame = ref(1)
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
}
function onScroll() {
  if (!scrollRaf) scrollRaf = requestAnimationFrame(trackScroll)
}
onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  trackScroll()
})
onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
})
</script>

<template>
  <article ref="rootEl">
    <div class="split">
      <!-- STICKY META -->
      <aside class="meta">
        <div class="crumb">
          <span v-if="disableNavigation" class="crumb__link is-disabled" aria-disabled="true">{{ t('albums.stickyBreadcrumb') }}</span>
          <NuxtLink v-else :to="localePath('/albums')">{{ t('albums.stickyBreadcrumb') }}</NuxtLink><span>/</span>
          <span v-if="disableNavigation" class="crumb__link is-disabled" aria-disabled="true" :lang="textLang(album.category)">{{ album.category }}</span>
          <NuxtLink v-else :to="categoryAlbumsPath" :lang="textLang(album.category)">{{ album.category }}</NuxtLink><span>/</span>
          <span class="here" :lang="textLang(album.title)">{{ album.title }}</span>
        </div>
        <div class="meta__thumb"><AppImg :src="cover" :alt="album.title" sizes="sm:100vw lg:360px" optimize /></div>
        <p class="meta__cat" :lang="textLang(album.category)">{{ album.category }}</p>
        <h1 class="meta__title" :lang="textLang(album.title)">{{ album.title }}</h1>
        <p class="meta__excerpt" :lang="textLang(album.excerpt)">{{ album.excerpt }}</p>
        <div class="meta__facts">
          <div class="meta__fact"><span class="k">{{ t('albums.category') }}</span><span class="v" :lang="textLang(album.category)">{{ album.category }}</span></div>
          <div class="meta__fact"><span class="k">{{ t('albums.date') }}</span><span class="v">{{ dateDisplay }}</span></div>
          <div v-if="album.location" class="meta__fact"><span class="k">{{ t('albums.location') }}</span><span class="v" :lang="textLang(album.location)">{{ album.location }}</span></div>
          <div class="meta__fact"><span class="k">{{ t('albums.frames') }}</span><span class="v">{{ imageCells.length }}</span></div>
        </div>
        <div class="meta__count"><span>{{ t('albums.frameLabel') }} <b>{{ pad(currentFrame) }}</b> / {{ pad(imageCells.length) }}</span></div>
      </aside>

      <!-- SCROLLING FRAMES -->
      <div class="frames">
        <figure
          v-for="(img, i) in imageCells"
          :key="i"
          :data-frame-n="i + 1"
          :data-row-n="img.row"
          :data-cell-n="img.cell"
          :class="{ 'is-admin-selected': selectedRow === img.row && (selectedCell === img.cell || selectedCell === undefined) }"
        >
          <div class="frame">
            <span class="frame__num">{{ pad(i + 1) }}</span>
            <AppImg :src="img.src" :alt="img.caption || album.title" sizes="sm:100vw lg:1100px" />
          </div>
          <figcaption v-if="img.caption" :lang="textLang(img.caption)">{{ img.caption }}</figcaption>
        </figure>
      </div>
    </div>
  </article>
</template>

<style scoped>
.crumb { margin-bottom: 1.5rem; }
.crumb :deep(a), .crumb__link { font-size: 0.56rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.crumb :deep(a):hover { color: var(--accent); }
.crumb__link.is-disabled { cursor: default; pointer-events: none; }
.crumb span { color: var(--subtle); margin: 0 0.45rem; font-size: 0.56rem; }
.crumb .here { color: var(--dark); letter-spacing: 0.2em; text-transform: uppercase; }

.split { display: grid; grid-template-columns: 360px 1fr; gap: 4rem; max-width: 1500px; margin: 0 auto; padding: 6rem 3rem 5rem; align-items: start; }

.meta { position: sticky; top: 6rem; }
.meta__thumb { width: 100%; overflow: hidden; margin-bottom: 1.75rem; background: var(--hero-bg); }
.meta__thumb :deep(img) { width: 100%; height: auto; display: block; object-fit: contain; }
.meta__cat { font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); margin-bottom: 1rem; }
.meta__title { font-family: var(--font-serif); font-size: clamp(2rem, 3vw, 3rem); font-weight: 200; line-height: 1; letter-spacing: -0.02em; margin-bottom: 1.5rem; white-space: pre-line; overflow-wrap: break-word; }
.meta__excerpt { font-size: 0.82rem; color: var(--muted); line-height: 1.85; margin-bottom: 2rem; white-space: pre-line; }
.meta__facts { border-top: 1px solid var(--subtle); }
.meta__fact { display: flex; justify-content: space-between; padding: 0.85rem 0; border-bottom: 1px solid var(--subtle); font-size: 0.62rem; letter-spacing: 0.08em; }
.meta__fact .k { text-transform: uppercase; letter-spacing: 0.18em; color: var(--muted); font-size: 0.52rem; }
.meta__fact .v { color: var(--dark); }
.meta__count { margin-top: 2rem; font-size: 0.54rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 1rem; }
.meta__count::before { content: ''; width: 30px; height: 1px; background: var(--accent); }
.meta__count b { color: var(--accent); font-weight: 500; }

.frames { display: flex; flex-direction: column; gap: 2rem; }
figure { margin: 0; }
.frame { overflow: hidden; background: var(--hero-bg); position: relative; }
.frame :deep(img) { width: 100%; display: block; object-fit: cover; }
.frame__num { position: absolute; top: 1rem; left: 1rem; z-index: 2; font-size: 0.5rem; letter-spacing: 0.18em; color: #F5F4F0; background: rgba(12, 12, 10, 0.5); backdrop-filter: blur(4px); padding: 0.4rem 0.6rem; }
figcaption { margin-top: 0.85rem; font-size: 0.6rem; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted); }

@media (max-width: 880px) {
  .split { grid-template-columns: 1fr; gap: 2.5rem; padding: 6rem 1.5rem 5rem; }
  .meta { position: static; }
}
</style>
