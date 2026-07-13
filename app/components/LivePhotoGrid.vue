<script setup lang="ts">
import type { PhotoGridImage } from '~~/server/api/photogrid.get'
import { consumePrewarmedPhotoGrid, PHOTO_GRID_BATCH_COUNT, prewarmPhotoGrid } from '~/utils/photoGridPreload'

// Museum-wall photogrid: a dense wall of small thumbnails randomly sourced
// from published albums, that keep crossfading to new photos over time.
//
// This component is only ever rendered client-side (wrap usage in
// <ClientOnly>) — its content depends on the browser (image aspect ratios,
// window size) and re-running the same random layout logic during SSR would
// produce different results than the client, causing a hydration mismatch.
//
// Bandwidth strategy: the server only ever hands us a bounded random sample,
// never the whole catalog. We swap a small, fixed number of blocks per tick
// on a stagger timer (so download rate stays flat regardless of catalog
// size), and only fetch a fresh sample when the current one runs low.
// Everything pauses when the grid is offscreen or the tab is hidden.
//
// Layout: a fixed rows x cols occupancy grid (per breakpoint) is what makes
// the wall's pixel height constant — it never depends on which shapes happen
// to be in play. Each block owns 1, 2, or 4 cells. When a swapped-in photo's
// real aspect ratio calls for more room than its block has, we try to merge
// it with neighboring 1x1 blocks (their photos go back into rotation, not
// discarded). When it calls for less room, the block breaks down into 1x1
// blocks and pulls fresh photos to fill the freed cells immediately. If
// neither move is possible, we just crossfade in place.

const SWAP_INTERVAL_MS = 3500
const SWAPS_PER_TICK = 3
const REFILL_THRESHOLD = 20
const IDLE_PAUSE_MS = 2 * 60 * 1000

type SizeClass = 'sm' | 'wide' | 'tall' | 'big'
const DIMS: Record<SizeClass, { w: number, h: number }> = {
  sm: { w: 1, h: 1 },
  wide: { w: 2, h: 1 },
  tall: { w: 1, h: 2 },
  big: { w: 2, h: 2 }
}

interface Block {
  id: number
  row: number
  col: number
  shape: SizeClass
  layers: [string, string]
  activeLayer: 0 | 1
}

interface GridConfig { cols: number, rows: number, rowHeight: number }
const GAP = 3

interface PreloadedGridImage {
  ratio: number
}

function currentGridConfig(): GridConfig {
  const w = window.innerWidth
  if (w <= 460) return { cols: 4, rows: 11, rowHeight: 64 }
  if (w <= 700) return { cols: 6, rows: 10, rowHeight: 70 }
  if (w <= 1100) return { cols: 10, rows: 9, rowHeight: 80 }
  return { cols: 16, rows: 10, rowHeight: 70 }
}

// Picks a target shape from a photo's real aspect ratio (width / height).
// Thresholds are set so common camera ratios actually land as wide/tall —
// e.g. 4:3 (1.333) and its portrait counterpart 3:4 (0.75) — rather than
// falling into the sm/big middle bucket reserved for near-square crops.
function shapeForRatio(ratio: number): SizeClass {
  if (ratio >= 1.2) return 'wide'
  if (ratio <= 0.83) return 'tall'
  return Math.random() < 0.25 ? 'big' : 'sm'
}

const { t } = useI18n()

const root = ref<HTMLElement | null>(null)
const gridConfig = ref<GridConfig>(currentGridConfig())
const blocks = ref<Block[]>([])
const queue = ref<string[]>([])
const shown = new Set<string>()

// Srcs whose bytes are fetched + decoded. Faces render at opacity 0 until
// their src lands here (see .cube__face.is-loaded) so a cell never shows the
// cream body-bg "white tile" while a photo is still in flight.
const loadedSrcs = reactive(new Set<string>())

function markFaceLoaded(src: string) {
  if (src) loadedSrcs.add(src)
}

// Id of the block currently under pointer/keyboard focus. We skip it in
// performSwap so the tile a user is inspecting doesn't flip away mid-hover.
const hoveredId = ref<number | null>(null)

// The album title backing a block's currently-shown photo, for the hover
// overlay affordance. albumMap is a plain (non-reactive) Map, but block
// reactivity already re-renders the cell when its shown layer changes.
function titleFor(block: Block): string {
  return albumMap.get(block.layers[block.activeLayer])?.albumTitle || ''
}

// ── Album mapping: track which album each image belongs to ──
const albumMap = new Map<string, Omit<PhotoGridImage, 'src'>>()

let rows = 0
let cols = 0
let occupancy: number[][] = []
let nextBlockId = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let observer: IntersectionObserver | null = null
let visible = false
let refilling = false
let initialLoaded = false
let initialLoading = false
let idlePaused = false
let idleTimerId: ReturnType<typeof setTimeout> | null = null

// ── Modal state ──
const modalOpen = ref(false)
const modalData = ref({
  albumId: '',
  albumTitle: '',
  albumCover: '',
  albumDate: '',
  albumDateEnd: '',
  photoCount: 0,
  clickedSrc: ''
})

function openModal(src: string) {
  const meta = albumMap.get(src)
  if (!meta) return
  modalData.value = {
    albumId: meta.albumId,
    albumTitle: meta.albumTitle,
    albumCover: meta.albumCover,
    albumDate: meta.albumDate,
    albumDateEnd: meta.albumDateEnd ?? '',
    photoCount: meta.photoCount,
    clickedSrc: src
  }
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

function handleCellClick(block: Block) {
  const src = block.layers[block.activeLayer]
  if (src) openModal(src)
}

const gridHeight = computed(() => {
  const { rows: r, rowHeight } = gridConfig.value
  return r * rowHeight + (r - 1) * GAP
})

function fits(r: number, c: number, w: number, h: number): boolean {
  if (r + h > rows || c + w > cols) return false
  for (let rr = r; rr < r + h; rr++) {
    for (let cc = c; cc < c + w; cc++) {
      if (occupancy[rr]![cc] !== -1) return false
    }
  }
  return true
}

function markOccupancy(r: number, c: number, w: number, h: number, id: number) {
  for (let rr = r; rr < r + h; rr++) {
    for (let cc = c; cc < c + w; cc++) {
      occupancy[rr]![cc] = id
    }
  }
}

function mergeOriginsFor(block: Block, w: number, h: number): Array<{ row: number, col: number }> {
  const rowsToTry = Array.from({ length: h }, (_, i) => block.row - (h - 1 - i))
  const colsToTry = Array.from({ length: w }, (_, i) => block.col - (w - 1 - i))
  const out: Array<{ row: number, col: number }> = []

  for (const row of rowsToTry) {
    for (const col of colsToTry) {
      if (row < 0 || col < 0 || row + h > rows || col + w > cols) continue
      out.push({ row, col })
    }
  }

  return out
}

function blockCells(block: Block): Array<{ row: number, col: number }> {
  const { w, h } = DIMS[block.shape]
  const cells: Array<{ row: number, col: number }> = []
  for (let rr = block.row; rr < block.row + h; rr++) {
    for (let cc = block.col; cc < block.col + w; cc++) {
      cells.push({ row: rr, col: cc })
    }
  }
  return cells
}

function cellKey(row: number, col: number) {
  return `${row}:${col}`
}

// First-fit greedy fill: guarantees full coverage with no holes, since 'sm'
// (1x1) always fits the current cell in a row-major scan.
function buildLayout(): Block[] {
  occupancy = Array.from({ length: rows }, () => Array(cols).fill(-1))
  const out: Block[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (occupancy[r]![c] !== -1) continue
      const roll = Math.random()
      const candidates: SizeClass[] =
        roll < 0.5 ? ['sm']
        : roll < 0.7 ? ['wide', 'sm']
        : roll < 0.9 ? ['tall', 'sm']
        : ['big', 'sm']

      for (const shape of candidates) {
        const { w, h } = DIMS[shape]
        if (fits(r, c, w, h)) {
          const id = nextBlockId++
          out.push({ id, row: r, col: c, shape, layers: ['', ''], activeLayer: 0 })
          markOccupancy(r, c, w, h, id)
          break
        }
      }
    }
  }
  return out
}

function rebuildLayout() {
  rows = gridConfig.value.rows
  cols = gridConfig.value.cols
  blocks.value = buildLayout()
}

function hasEmptyBlocks() {
  return blocks.value.some(block => !block.layers[block.activeLayer])
}

function recycleActiveImages() {
  const recycled: string[] = []
  for (const block of blocks.value) {
    const src = block.layers[block.activeLayer]
    if (!src) continue
    shown.delete(src)
    if (!queue.value.includes(src)) recycled.push(src)
  }
  queue.value.unshift(...recycled)
}

// Ids of blocks whose fill photo is still being preloaded, so overlapping
// calls (tick refill + reshape/split aftermath) never double-assign a cell.
const pendingFillIds = new Set<number>()

// Fills empty cells, but only reveals each photo after its bytes are fetched
// and decoded — assigning the src directly would paint the cream body-bg
// through the empty face while the download is in flight.
function fillEmptyBlocks() {
  for (const block of blocks.value) {
    if (block.layers[block.activeLayer] || pendingFillIds.has(block.id)) continue
    const src = nextImage()
    if (!src) break
    pendingFillIds.add(block.id)
    void preloadGridImage(src)
      .then(() => {
        const idx = blocks.value.findIndex(b => b.id === block.id)
        const target = idx === -1 ? null : blocks.value[idx]!
        if (!target || target.layers[target.activeLayer]) {
          releaseImage(src)
          return
        }
        const layers: [string, string] = [...target.layers]
        layers[target.activeLayer] = src
        blocks.value[idx] = { ...target, layers }
      })
      .catch(() => releaseImage(src))
      .finally(() => pendingFillIds.delete(block.id))
  }
}

async function fetchBatch(): Promise<string[]> {
  try {
    const warmed = consumePrewarmedPhotoGrid()
    const images = warmed ?? await prewarmPhotoGrid()
    return mapPhotoGridImages(images)
  } catch {
    return []
  }
}

function mapPhotoGridImages(images: PhotoGridImage[]): string[] {
  // Populate the album lookup map
  for (const img of images) {
    if (!albumMap.has(img.src)) {
      albumMap.set(img.src, {
        albumId: img.albumId,
        albumTitle: img.albumTitle,
        albumCover: img.albumCover,
        albumDate: img.albumDate,
        albumDateEnd: img.albumDateEnd,
        photoCount: img.photoCount
      })
    }
  }
  return images.map(img => img.src)
}

function enqueueUnseen(images: string[]) {
  for (const src of images) {
    if (!shown.has(src) && !queue.value.includes(src)) queue.value.push(src)
  }
}

async function refillIfLow() {
  if (!shouldRun() || refilling) return
  if (queue.value.length > REFILL_THRESHOLD && !hasEmptyBlocks()) return
  refilling = true
  const res = await $fetch<{ images: PhotoGridImage[] }>('/api/photogrid', { query: { count: PHOTO_GRID_BATCH_COUNT } }).catch(() => ({ images: [] }))
  const batch = mapPhotoGridImages(res.images ?? [])
  enqueueUnseen(batch)
  fillEmptyBlocks()
  refilling = false
}

function nextImage(): string | null {
  const src = queue.value.shift() ?? null
  if (src) shown.add(src)
  return src
}

async function preloadGridImage(src: string): Promise<PreloadedGridImage> {
  const img = new Image()
  img.decoding = 'async'
  img.loading = 'eager'

  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error(`Unable to preload photo grid image: ${src}`))
  })

  img.src = src
  if (!img.complete) await loaded

  // `onload` means the bytes arrived, but the next paint can still miss while
  // the browser decodes. Wait for decode before Vue flips the visible face.
  if (typeof img.decode === 'function') {
    await img.decode().catch(() => undefined)
  }

  if (!img.naturalWidth || !img.naturalHeight) {
    throw new Error(`Unable to read photo grid image dimensions: ${src}`)
  }

  markFaceLoaded(src)
  return { ratio: img.naturalWidth / img.naturalHeight }
}

function releaseImage(src: string) {
  shown.delete(src)
  if (!queue.value.includes(src)) queue.value.push(src)
}

function crossfadeInPlace(block: Block, src: string) {
  const idx = blocks.value.findIndex(b => b.id === block.id)
  if (idx === -1) return
  const nextLayer: 0 | 1 = block.activeLayer === 0 ? 1 : 0
  const layers: [string, string] = [...block.layers]
  layers[nextLayer] = src
  blocks.value[idx] = { ...block, layers, activeLayer: nextLayer }
}

// Reshapes `block` into `targetShape`, even when the needed cells are owned by
// larger neighboring blocks. Any displaced footprint is split back into fresh
// 1x1 cells so a portrait can force the cell above it to update and the
// leftovers do not keep stale cropped fragments.
function tryReshape(block: Block, targetShape: SizeClass, src: string): boolean {
  const { w, h } = DIMS[targetShape]
  if (w === 1 && h === 1) return false

  for (const origin of mergeOriginsFor(block, w, h)) {
    const affectedById = new Map<number, Block>()

    for (let rr = origin.row; rr < origin.row + h; rr++) {
      for (let cc = origin.col; cc < origin.col + w; cc++) {
        const id = occupancy[rr]![cc]
        const nb = blocks.value.find(b => b.id === id)
        if (!nb) continue
        affectedById.set(nb.id, nb)
      }
    }
    affectedById.set(block.id, block)

    const affected = [...affectedById.values()]
    const freedCells = new Map<string, { row: number, col: number }>()
    const targetCells = new Set<string>()

    for (let rr = origin.row; rr < origin.row + h; rr++) {
      for (let cc = origin.col; cc < origin.col + w; cc++) {
        targetCells.add(cellKey(rr, cc))
      }
    }

    const retired: string[] = []
    for (const b of affected) {
      const shownSrc = b.layers[b.activeLayer]
      if (shownSrc) {
        shown.delete(shownSrc)
        retired.push(shownSrc)
      }
      for (const cell of blockCells(b)) freedCells.set(cellKey(cell.row, cell.col), cell)
    }

    const affectedIds = new Set(affected.map(b => b.id))
    blocks.value = blocks.value.filter(b => !affectedIds.has(b.id))
    for (const b of affected) {
      const { w: bw, h: bh } = DIMS[b.shape]
      markOccupancy(b.row, b.col, bw, bh, -1)
    }

    const merged: Block = {
      id: nextBlockId++,
      row: origin.row,
      col: origin.col,
      shape: targetShape,
      layers: [src, ''],
      activeLayer: 0
    }
    blocks.value.push(merged)
    markOccupancy(origin.row, origin.col, w, h, merged.id)

    const leftovers = [...freedCells.values()]
      .filter(cell => !targetCells.has(cellKey(cell.row, cell.col)))
      .sort((a, b) => a.row - b.row || a.col - b.col)

    // Leftover cells start empty — the preload-gated fillEmptyBlocks assigns
    // them photos once fetched, instead of painting an in-flight src.
    for (const cell of leftovers) {
      const id = nextBlockId++
      blocks.value.push({
        id,
        row: cell.row,
        col: cell.col,
        shape: 'sm',
        layers: ['', ''],
        activeLayer: 0
      })
      markOccupancy(cell.row, cell.col, 1, 1, id)
    }
    fillEmptyBlocks()

    queue.value.push(...retired)
    return true
  }
  return false
}

// Breaks `block` down into 1x1 'sm' blocks, giving the triggering photo to
// the anchor cell and pulling additional photos from the queue to fill the
// other freed cells immediately (best effort — any still empty get filled
// on the next few ticks like normal).
function trySplit(block: Block, src: string): boolean {
  const { w, h } = DIMS[block.shape]
  if (w * h <= 1) return false

  const cells: Array<{ r: number, c: number }> = []
  for (let rr = block.row; rr < block.row + h; rr++) {
    for (let cc = block.col; cc < block.col + w; cc++) {
      cells.push({ r: rr, c: cc })
    }
  }

  blocks.value = blocks.value.filter(b => b.id !== block.id)
  markOccupancy(block.row, block.col, w, h, -1)

  // The anchor keeps the (already preloaded) triggering photo; the other freed
  // cells start empty and are filled by the preload-gated fillEmptyBlocks below.
  const created: Block[] = cells.map((cell, i) => {
    const id = nextBlockId++
    markOccupancy(cell.r, cell.c, 1, 1, id)
    return { id, row: cell.r, col: cell.c, shape: 'sm', layers: [i === 0 ? src : '', ''], activeLayer: 0 }
  })
  blocks.value.push(...created)
  fillEmptyBlocks()
  return true
}

function applySwap(reservedId: number, src: string, targetShape: SizeClass): boolean {
  // The block may have been absorbed as a merge neighbor by a *different*
  // concurrent swap since it was reserved — bail out gracefully rather than
  // operating on cells that now belong to another block.
  const block = blocks.value.find(b => b.id === reservedId)
  if (!block) return false

  if (block.shape === targetShape) {
    crossfadeInPlace(block, src)
    return true
  }

  const targetArea = DIMS[targetShape].w * DIMS[targetShape].h
  const blockArea = DIMS[block.shape].w * DIMS[block.shape].h

  if (targetShape !== 'sm' && tryReshape(block, targetShape, src)) return true
  if (targetArea < blockArea && trySplit(block, src)) return true

  // No compatible footprint to reshape into — just crossfade in the existing
  // slot rather than leaving the cell blank.
  crossfadeInPlace(block, src)
  return true
}

// `reserved` holds block ids already claimed by other swaps still in flight
// this tick, so two simultaneous swaps can never target the same tile —
// that would otherwise snap an in-progress flip backward mid-rotation.
function performSwap(reserved: Set<number>) {
  const candidates = blocks.value.filter(b => !reserved.has(b.id) && b.id !== hoveredId.value)
  if (!candidates.length) return
  const block = candidates[Math.floor(Math.random() * candidates.length)]!
  reserved.add(block.id)

  const src = nextImage()
  if (!src) return
  void preloadGridImage(src)
    .then(({ ratio }) => {
      if (!shouldRun()) {
        releaseImage(src)
        return
      }
      if (!applySwap(block.id, src, shapeForRatio(ratio))) releaseImage(src)
    })
    .catch(() => {
      releaseImage(src)
    })
}

function tick() {
  if (!shouldRun()) {
    stop()
    return
  }
  const reserved = new Set<number>()
  for (let i = 0; i < SWAPS_PER_TICK; i++) performSwap(reserved)
  void refillIfLow()
}

function isPageActive() {
  return !document.hidden && document.hasFocus()
}

function shouldRun() {
  return visible && isPageActive() && !idlePaused
}

function start() {
  if (!shouldRun()) return
  if (intervalId) return
  intervalId = setInterval(tick, SWAP_INTERVAL_MS)
}

function stop() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

function clearIdleTimer() {
  if (!idleTimerId) return
  clearTimeout(idleTimerId)
  idleTimerId = null
}

function scheduleIdlePause() {
  clearIdleTimer()
  idleTimerId = setTimeout(() => {
    idlePaused = true
    stop()
  }, IDLE_PAUSE_MS)
}

function markActive() {
  idlePaused = false
  scheduleIdlePause()
  syncActivity()
}

async function ensureInitialLoad() {
  if (initialLoaded || initialLoading || !shouldRun()) return
  initialLoading = true
  const batch = await fetchBatch()
  enqueueUnseen(batch)
  fillEmptyBlocks()
  initialLoaded = batch.length > 0 || queue.value.length > 0 || blocks.value.some(block => block.layers[block.activeLayer])
  initialLoading = false
  if (shouldRun()) {
    start()
    void refillIfLow()
  }
}

function syncActivity() {
  if (!shouldRun()) {
    stop()
    return
  }
  void ensureInitialLoad()
  start()
}

function handleVisibilityChange() {
  syncActivity()
}

function handleFocusChange() {
  if (document.hasFocus() && !document.hidden) markActive()
  else syncActivity()
}

function handleUserActivity() {
  if (document.hidden) return
  markActive()
}

function handleResize() {
  const cfg = currentGridConfig()
  if (cfg.cols === gridConfig.value.cols && cfg.rows === gridConfig.value.rows) return
  recycleActiveImages()
  gridConfig.value = cfg
  rebuildLayout()
  fillEmptyBlocks()
  if (shouldRun()) void refillIfLow()
}

onMounted(async () => {
  rebuildLayout()
  window.addEventListener('resize', handleResize)

  if (root.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      syncActivity()
    }, { threshold: 0.1 })
    observer.observe(root.value)
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('focus', handleFocusChange)
  window.addEventListener('blur', handleFocusChange)
  window.addEventListener('pointerdown', handleUserActivity, { passive: true })
  window.addEventListener('keydown', handleUserActivity)
  window.addEventListener('wheel', handleUserActivity, { passive: true })
  window.addEventListener('scroll', handleUserActivity, { passive: true })
  window.addEventListener('touchstart', handleUserActivity, { passive: true })
  scheduleIdlePause()
  await ensureInitialLoad()
})

onBeforeUnmount(() => {
  stop()
  clearIdleTimer()
  observer?.disconnect()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('focus', handleFocusChange)
  window.removeEventListener('blur', handleFocusChange)
  window.removeEventListener('pointerdown', handleUserActivity)
  window.removeEventListener('keydown', handleUserActivity)
  window.removeEventListener('wheel', handleUserActivity)
  window.removeEventListener('scroll', handleUserActivity)
  window.removeEventListener('touchstart', handleUserActivity)
})
</script>

<template>
  <div ref="root" :style="{ height: gridHeight + 'px' }">
    <TransitionGroup tag="div" name="tile" class="photogrid">
      <div
        v-for="block in blocks"
        :key="block.id"
        class="photogrid__cell"
        :style="{
          gridColumn: `${block.col + 1} / span ${DIMS[block.shape].w}`,
          gridRow: `${block.row + 1} / span ${DIMS[block.shape].h}`
        }"
        role="button"
        tabindex="0"
        :aria-label="titleFor(block)"
        @click="handleCellClick(block)"
        @keydown.enter="handleCellClick(block)"
        @mouseenter="hoveredId = block.id"
        @mouseleave="hoveredId = null"
        @focus="hoveredId = block.id"
        @blur="hoveredId = null"
      >
        <div class="cube" :class="{ 'is-flipped': block.activeLayer === 1 }">
          <img
            v-if="block.layers[0]"
            :src="block.layers[0]"
            alt=""
            loading="lazy"
            decoding="async"
            class="cube__face cube__face--front"
            :class="{ 'is-loaded': loadedSrcs.has(block.layers[0]) }"
            @load="markFaceLoaded(block.layers[0])"
          >
          <img
            v-if="block.layers[1]"
            :src="block.layers[1]"
            alt=""
            loading="lazy"
            decoding="async"
            class="cube__face cube__face--back"
            :class="{ 'is-loaded': loadedSrcs.has(block.layers[1]) }"
            @load="markFaceLoaded(block.layers[1])"
          >
        </div>
        <div class="photogrid__overlay" aria-hidden="true">
          <span class="photogrid__kicker">{{ t('common.album') }}</span>
          <span v-if="titleFor(block)" class="photogrid__title">{{ titleFor(block) }}</span>
        </div>
      </div>
    </TransitionGroup>

    <AlbumPreviewModal
      :open="modalOpen"
      :album-id="modalData.albumId"
      :album-title="modalData.albumTitle"
      :album-cover="modalData.albumCover"
      :album-date="modalData.albumDate"
      :album-date-end="modalData.albumDateEnd"
      :photo-count="modalData.photoCount"
      :clicked-src="modalData.clickedSrc"
      @close="closeModal"
    />
  </div>
</template>

<style scoped>
.photogrid {
  display: grid;
  grid-template-columns: repeat(16, 1fr);
  grid-auto-rows: 70px;
  gap: 3px;
  background: var(--body-bg, #0c0c0a);
  /* Height is a pure function of rows/rowHeight (see gridHeight) — it never
     depends on which shapes happen to be in play, so merges/splits never
     move the container's footprint. overflow:hidden is a cushion in case a
     resize briefly leaves stale content before rebuildLayout() repaints. */
  overflow: hidden;
}

.photogrid__cell {
  position: relative;
  overflow: hidden;
  perspective: 800px;
  cursor: pointer;
  background: var(--body-bg, #0c0c0a);
}
.photogrid__cell:hover,
.photogrid__cell:focus-visible {
  z-index: 2;
}
.photogrid__cell:focus-visible {
  outline: 2px solid var(--accent, #e63946);
  outline-offset: -2px;
}

/* Editorial hover affordance: a soft bottom gradient that surfaces the album
   name so the wall reads as a set of clickable album links. Lives as a sibling
   of .cube (not inside it) so it never touches the cube's preserve-3d flip.
   pointer-events:none keeps the click landing on the cell. */
.photogrid__overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.15em;
  padding: 0.4rem 0.45rem;
  pointer-events: none;
  opacity: 0;
  background: linear-gradient(
    to top,
    rgba(12, 12, 10, 0.9) 0%,
    rgba(12, 12, 10, 0.55) 38%,
    rgba(12, 12, 10, 0) 72%
  );
  transition: opacity 0.4s ease;
}
.photogrid__cell:hover .photogrid__overlay,
.photogrid__cell:focus-visible .photogrid__overlay {
  opacity: 1;
}

.photogrid__kicker {
  font-family: var(--font-latin-sans, sans-serif);
  font-size: 0.44rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent, #e63946);
}
.photogrid__title {
  font-family: var(--font-serif, serif);
  font-size: 0.68rem;
  line-height: 1.15;
  font-weight: 400;
  color: #f5f4f0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.cube {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
  transition: transform 1s cubic-bezier(0.65, 0, 0.35, 1);
}
.cube.is-flipped {
  transform: rotateY(180deg);
}

.cube__face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  backface-visibility: hidden;
  /* Only the hover zoom animates here — the flip lives on the parent .cube, so
     this transition never competes with rotateY. Composing scale after the
     face's own rotateY keeps backface-visibility working. */
  transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.45s ease;
  background: var(--body-bg, #0c0c0a);
  /* Invisible until the photo is fetched + decoded (is-loaded), so a face
     mid-download never paints as a blank tile. */
  opacity: 0;
}
.cube__face.is-loaded {
  opacity: 1;
}
.cube__face--front {
  transform: rotateY(0deg);
}
.cube__face--back {
  transform: rotateY(180deg);
}
.photogrid__cell:hover .cube__face--front,
.photogrid__cell:focus-visible .cube__face--front {
  transform: rotateY(0deg) scale(1.08);
}
.photogrid__cell:hover .cube__face--back,
.photogrid__cell:focus-visible .cube__face--back {
  transform: rotateY(180deg) scale(1.08);
}

/* Tiles created/destroyed by a reshape (merge/split) don't have a "before"
   state to crossfade from via the cube flip — without this, they used to
   just pop in/out instantly. TransitionGroup gives them a real enter/leave
   animation instead. */
.tile-enter-active,
.tile-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}
.tile-enter-from {
  opacity: 0;
  transform: scale(0.85);
}
.tile-leave-to {
  opacity: 0;
  transform: scale(0.85);
}
.tile-leave-active {
  /* Grid items are explicitly placed (grid-column/row), so a leaving tile
     can safely stay in flow while it fades — no reflow risk of siblings. */
  z-index: 0;
}

/* Under reduced-motion, keep the overlay reveal (opacity only) but drop the
   image zoom so nothing scales. */
@media (prefers-reduced-motion: reduce) {
  .cube__face {
    transition: none;
  }
  .photogrid__cell:hover .cube__face--front,
  .photogrid__cell:focus-visible .cube__face--front {
    transform: rotateY(0deg);
  }
  .photogrid__cell:hover .cube__face--back,
  .photogrid__cell:focus-visible .cube__face--back {
    transform: rotateY(180deg);
  }
}

@media (max-width: 1100px) {
  .photogrid { grid-template-columns: repeat(10, 1fr); grid-auto-rows: 80px; }
}
@media (max-width: 700px) {
  .photogrid { grid-template-columns: repeat(6, 1fr); grid-auto-rows: 70px; }
}
@media (max-width: 460px) {
  .photogrid { grid-template-columns: repeat(4, 1fr); grid-auto-rows: 64px; }
}
</style>
