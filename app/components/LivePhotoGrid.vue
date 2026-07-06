<script setup lang="ts">
// Museum-wall photogrid: a dense wall of small thumbnails randomly sourced
// from published albums, that keep crossfading to new photos over time.
//
// Bandwidth strategy (see plan): the server only ever hands us a bounded
// random sample, never the whole catalog. We swap one tile at a time on a
// stagger timer (so download rate stays flat regardless of catalog size),
// and only fetch a fresh sample when the current one runs low. Everything
// pauses when the grid is offscreen or the tab is hidden.

const TILE_COUNT = 70
const SWAP_INTERVAL_MS = 3500
const REFILL_THRESHOLD = 20
const BATCH_COUNT = 250

type SizeClass = 'sm' | 'wide' | 'tall' | 'big'
const SPANS: Record<SizeClass, { col: number, row: number }> = {
  sm: { col: 1, row: 1 },
  wide: { col: 2, row: 1 },
  tall: { col: 1, row: 2 },
  big: { col: 2, row: 2 }
}

function pickSize(): SizeClass {
  const r = Math.random()
  if (r < 0.55) return 'sm'
  if (r < 0.75) return 'wide'
  if (r < 0.92) return 'tall'
  return 'big'
}

interface Tile {
  key: number
  size: SizeClass
  layers: [string, string]
  activeLayer: 0 | 1
}

// Breakpoints mirrored from the CSS below — kept in sync so the JS height
// calculation matches whatever column count/row height is actually in effect.
const BREAKPOINTS = [
  { maxWidth: 460, columns: 4, rowHeight: 64 },
  { maxWidth: 700, columns: 6, rowHeight: 70 },
  { maxWidth: 1100, columns: 10, rowHeight: 80 },
  { maxWidth: Infinity, columns: 16, rowHeight: 70 }
]
const GAP = 3

let tileKeyCounter = 0

// Sizes are rolled up front, synchronously, so the grid's real footprint is
// known and reserved before any image has loaded — the placeholder tiles
// ARE the final layout, just with empty <img> layers filled in later.
function makePlaceholderTiles(): Tile[] {
  const out: Tile[] = []
  for (let i = 0; i < TILE_COUNT; i++) {
    tileKeyCounter++
    out.push({ key: tileKeyCounter, size: pickSize(), layers: ['', ''], activeLayer: 0 })
  }
  return out
}

const root = ref<HTMLElement | null>(null)
const tiles = ref<Tile[]>(makePlaceholderTiles())
const queue = ref<string[]>([])
const shown = new Set<string>()
// Defaults to "no media query active" (desktop) to match the CSS's own
// default rule, since we don't know the real viewport until mount.
const viewportWidth = ref(Infinity)

let intervalId: ReturnType<typeof setInterval> | null = null
let observer: IntersectionObserver | null = null
let visible = false
let refilling = false

const activeBreakpoint = computed(() =>
  BREAKPOINTS.find(bp => viewportWidth.value <= bp.maxWidth) ?? BREAKPOINTS[BREAKPOINTS.length - 1]!
)

// Exact height for the CURRENT set of tile sizes (not a statistical average),
// recomputed whenever tiles change size (swap) or the viewport breakpoint
// changes — this is what keeps the container from ever jumping.
const gridHeight = computed(() => {
  const { columns, rowHeight } = activeBreakpoint.value
  const totalArea = tiles.value.reduce((sum, t) => sum + SPANS[t.size].col * SPANS[t.size].row, 0)
  const rows = Math.max(1, Math.ceil(totalArea / columns))
  return rows * rowHeight + (rows - 1) * GAP
})

function updateViewportWidth() {
  viewportWidth.value = window.innerWidth
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

function swapRandomTile() {
  if (!tiles.value.length) return
  const src = nextImage()
  if (!src) return

  const preload = new Image()
  preload.onload = () => {
    const idx = Math.floor(Math.random() * tiles.value.length)
    const tile = tiles.value[idx]!
    const nextLayer: 0 | 1 = tile.activeLayer === 0 ? 1 : 0
    const layers: [string, string] = [...tile.layers]
    layers[nextLayer] = src
    tiles.value[idx] = { ...tile, size: pickSize(), layers, activeLayer: nextLayer }
  }
  preload.src = src
}

function tick() {
  if (!visible) return
  swapRandomTile()
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

onMounted(async () => {
  updateViewportWidth()
  window.addEventListener('resize', updateViewportWidth)

  if (root.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible && !document.hidden) start()
      else stop()
    }, { threshold: 0.1 })
    observer.observe(root.value)
  }
  document.addEventListener('visibilitychange', handleVisibilityChange)

  // Placeholder tiles (and thus the grid's real height) already exist —
  // this just fills their first image in, without changing any sizes.
  const batch = await fetchBatch()
  enqueueUnseen(batch)
  for (const tile of tiles.value) {
    const src = nextImage()
    if (!src) break
    tile.layers[0] = src
  }
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  window.removeEventListener('resize', updateViewportWidth)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div ref="root" class="photogrid" :style="{ height: gridHeight + 'px' }">
    <div
      v-for="tile in tiles"
      :key="tile.key"
      class="photogrid__cell"
      :style="{ gridColumn: `span ${SPANS[tile.size].col}`, gridRow: `span ${SPANS[tile.size].row}` }"
    >
      <img
        v-if="tile.layers[0]"
        :src="tile.layers[0]"
        alt=""
        loading="lazy"
        class="photogrid__img"
        :class="{ 'is-active': tile.activeLayer === 0 }"
      >
      <img
        v-if="tile.layers[1]"
        :src="tile.layers[1]"
        alt=""
        loading="lazy"
        class="photogrid__img"
        :class="{ 'is-active': tile.activeLayer === 1 }"
      >
    </div>
  </div>
</template>

<style scoped>
.photogrid {
  display: grid;
  grid-auto-flow: dense;
  grid-template-columns: repeat(16, 1fr);
  grid-auto-rows: 70px;
  gap: 3px;
  background: var(--body-bg, #0c0c0a);
  /* height is set inline from the `gridHeight` computed — derived from the
     actual tile sizes in play, not an average guess, so it never jumps on
     load or drifts as tiles swap. overflow:hidden is just a cushion for the
     dense-packing row estimate being off by a fraction of a row. */
  overflow: hidden;
}

.photogrid__cell {
  position: relative;
  overflow: hidden;
}

.photogrid__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: 0;
  transform: scale(1.08);
  transition:
    opacity 1.1s ease,
    transform 1.8s ease;
}
.photogrid__img.is-active {
  opacity: 1;
  transform: scale(1);
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
