<script setup lang="ts">
// Museum-wall photogrid: a dense wall of small thumbnails randomly sourced
// from published albums, that keep crossfading to new photos over time.
//
// Bandwidth strategy (see plan): the server only ever hands us a bounded
// random sample, never the whole catalog. We swap one tile at a time on a
// stagger timer (so download rate stays flat regardless of catalog size),
// and only fetch a fresh sample when the current one runs low. Everything
// pauses when the grid is offscreen or the tab is hidden.

const TILE_COUNT = 120
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

const root = ref<HTMLElement | null>(null)
const tiles = ref<Tile[]>([])
const queue = ref<string[]>([])
const shown = new Set<string>()

let tileKeyCounter = 0
let intervalId: ReturnType<typeof setInterval> | null = null
let observer: IntersectionObserver | null = null
let visible = false
let refilling = false

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
  const batch = await fetchBatch()
  enqueueUnseen(batch)

  const initial: Tile[] = []
  for (let i = 0; i < TILE_COUNT; i++) {
    const src = nextImage()
    if (!src) break
    tileKeyCounter++
    initial.push({ key: tileKeyCounter, size: pickSize(), layers: [src, ''], activeLayer: 0 })
  }
  tiles.value = initial

  if (root.value) {
    observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false
      if (visible && !document.hidden) start()
      else stop()
    }, { threshold: 0.1 })
    observer.observe(root.value)
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
})

onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div ref="root" class="photogrid">
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
  grid-template-columns: repeat(14, 1fr);
  grid-auto-rows: 92px;
  gap: 3px;
  background: var(--body-bg, #0c0c0a);
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
