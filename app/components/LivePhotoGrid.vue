<script setup lang="ts">
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
const BATCH_COUNT = 250

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

function currentGridConfig(): GridConfig {
  const w = window.innerWidth
  if (w <= 460) return { cols: 4, rows: 9, rowHeight: 64 }
  if (w <= 700) return { cols: 6, rows: 8, rowHeight: 70 }
  if (w <= 1100) return { cols: 10, rows: 7, rowHeight: 80 }
  return { cols: 16, rows: 8, rowHeight: 70 }
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

const root = ref<HTMLElement | null>(null)
const gridConfig = ref<GridConfig>(currentGridConfig())
const blocks = ref<Block[]>([])
const queue = ref<string[]>([])
const shown = new Set<string>()

let rows = 0
let cols = 0
let occupancy: number[][] = []
let nextBlockId = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let observer: IntersectionObserver | null = null
let visible = false
let refilling = false

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

function fillEmptyBlocks() {
  for (const block of blocks.value) {
    if (block.layers[block.activeLayer]) continue
    const src = nextImage()
    if (!src) break
    block.layers[block.activeLayer] = src
  }
}

async function fetchBatch(): Promise<string[]> {
  try {
    const res = await $fetch<{ images: string[] }>('/api/photogrid', { query: { count: BATCH_COUNT } })
    return res.images ?? []
  } catch {
    return []
  }
}

function enqueueUnseen(images: string[]) {
  for (const src of images) {
    if (!shown.has(src) && !queue.value.includes(src)) queue.value.push(src)
  }
}

async function refillIfLow() {
  if (refilling || queue.value.length > REFILL_THRESHOLD) return
  refilling = true
  const batch = await fetchBatch()
  enqueueUnseen(batch)
  refilling = false
}

function nextImage(): string | null {
  const src = queue.value.shift() ?? null
  if (src) shown.add(src)
  return src
}

function crossfadeInPlace(block: Block, src: string) {
  const idx = blocks.value.findIndex(b => b.id === block.id)
  if (idx === -1) return
  const nextLayer: 0 | 1 = block.activeLayer === 0 ? 1 : 0
  const layers: [string, string] = [...block.layers]
  layers[nextLayer] = src
  blocks.value[idx] = { ...block, layers, activeLayer: nextLayer }
}

// Absorbs neighboring 'sm' blocks so `anchor` can grow into `targetShape`.
// Only starts from an 'sm' anchor — merging out of an already-bigger block
// is out of scope. Absorbed blocks' current photos go back to the front of
// the queue instead of being discarded.
function tryMerge(anchor: Block, targetShape: SizeClass, src: string): boolean {
  if (anchor.shape !== 'sm') return false
  const { w, h } = DIMS[targetShape]
  if (w === 1 && h === 1) return false
  if (anchor.row + h > rows || anchor.col + w > cols) return false

  const neighbors: Block[] = []
  for (let rr = anchor.row; rr < anchor.row + h; rr++) {
    for (let cc = anchor.col; cc < anchor.col + w; cc++) {
      if (rr === anchor.row && cc === anchor.col) continue
      const id = occupancy[rr]![cc]
      const nb = blocks.value.find(b => b.id === id)
      if (!nb || nb.shape !== 'sm' || nb.row !== rr || nb.col !== cc) return false
      neighbors.push(nb)
    }
  }

  const absorbed = [anchor, ...neighbors]
  for (const b of absorbed) {
    const shownSrc = b.layers[b.activeLayer]
    if (shownSrc) {
      shown.delete(shownSrc)
      queue.value.unshift(shownSrc)
    }
  }

  const absorbedIds = new Set(absorbed.map(b => b.id))
  blocks.value = blocks.value.filter(b => !absorbedIds.has(b.id))

  const merged: Block = {
    id: nextBlockId++,
    row: anchor.row,
    col: anchor.col,
    shape: targetShape,
    layers: [src, ''],
    activeLayer: 0
  }
  blocks.value.push(merged)
  markOccupancy(anchor.row, anchor.col, w, h, merged.id)
  return true
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

  const pulled: string[] = [src]
  for (let i = 1; i < cells.length; i++) pulled.push(nextImage() ?? '')

  const created: Block[] = cells.map((cell, i) => {
    const id = nextBlockId++
    markOccupancy(cell.r, cell.c, 1, 1, id)
    return { id, row: cell.r, col: cell.c, shape: 'sm', layers: [pulled[i] ?? '', ''], activeLayer: 0 }
  })
  blocks.value.push(...created)
  return true
}

function applySwap(reservedId: number, src: string, targetShape: SizeClass) {
  // The block may have been absorbed as a merge neighbor by a *different*
  // concurrent swap since it was reserved — bail out gracefully rather than
  // operating on cells that now belong to another block.
  const block = blocks.value.find(b => b.id === reservedId)
  if (!block) return

  if (block.shape === targetShape) {
    crossfadeInPlace(block, src)
    return
  }

  const targetArea = DIMS[targetShape].w * DIMS[targetShape].h
  const blockArea = DIMS[block.shape].w * DIMS[block.shape].h

  if (targetArea > blockArea && tryMerge(block, targetShape, src)) return
  if (targetArea < blockArea && trySplit(block, src)) return

  // Same area but different shape (wide <-> tall), or no compatible
  // neighbors to merge with — just crossfade in the existing slot.
  crossfadeInPlace(block, src)
}

// `reserved` holds block ids already claimed by other swaps still in flight
// this tick, so two simultaneous swaps can never target the same tile —
// that would otherwise snap an in-progress flip backward mid-rotation.
function performSwap(reserved: Set<number>) {
  const candidates = blocks.value.filter(b => !reserved.has(b.id))
  if (!candidates.length) return
  const block = candidates[Math.floor(Math.random() * candidates.length)]!
  reserved.add(block.id)

  const src = nextImage()
  if (!src) return
  const preload = new Image()
  preload.onload = () => {
    const ratio = preload.naturalWidth / preload.naturalHeight || 1
    applySwap(block.id, src, shapeForRatio(ratio))
  }
  preload.src = src
}

function tick() {
  if (!visible) return
  const reserved = new Set<number>()
  for (let i = 0; i < SWAPS_PER_TICK; i++) performSwap(reserved)
  void refillIfLow()
}

function start() {
  if (intervalId) return
  intervalId = setInterval(tick, SWAP_INTERVAL_MS)
}

function stop() {
  if (!intervalId) return
  clearInterval(intervalId)
  intervalId = null
}

function handleVisibilityChange() {
  if (document.hidden) stop()
  else if (visible) start()
}

function handleResize() {
  const cfg = currentGridConfig()
  if (cfg.cols === gridConfig.value.cols && cfg.rows === gridConfig.value.rows) return
  gridConfig.value = cfg
  rebuildLayout()
  fillEmptyBlocks()
  void refillIfLow()
}

onMounted(async () => {
  rebuildLayout()
  window.addEventListener('resize', handleResize)

  if (root.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible && !document.hidden) start()
      else stop()
    }, { threshold: 0.1 })
    observer.observe(root.value)
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  const batch = await fetchBatch()
  enqueueUnseen(batch)
  fillEmptyBlocks()
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  window.removeEventListener('resize', handleResize)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div ref="root" class="photogrid" :style="{ height: gridHeight + 'px' }">
    <div
      v-for="block in blocks"
      :key="block.id"
      class="photogrid__cell"
      :style="{
        gridColumn: `${block.col + 1} / span ${DIMS[block.shape].w}`,
        gridRow: `${block.row + 1} / span ${DIMS[block.shape].h}`
      }"
    >
      <div class="cube" :class="{ 'is-flipped': block.activeLayer === 1 }">
        <img
          v-if="block.layers[0]"
          :src="block.layers[0]"
          alt=""
          loading="lazy"
          class="cube__face cube__face--front"
        >
        <img
          v-if="block.layers[1]"
          :src="block.layers[1]"
          alt=""
          loading="lazy"
          class="cube__face cube__face--back"
        >
      </div>
    </div>
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
}
.cube__face--front {
  transform: rotateY(0deg);
}
.cube__face--back {
  transform: rotateY(180deg);
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
