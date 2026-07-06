<script setup lang="ts">
// Museum-wall photogrid: a dense wall of small thumbnails randomly sourced
// from published albums, that keep crossfading to new photos over time.
//
// Bandwidth strategy (see plan): the server only ever hands us a bounded
// random sample, never the whole catalog. We swap one tile at a time on a
// stagger timer (so download rate stays flat regardless of catalog size),
// and only fetch a fresh sample when the current one runs low. Everything
// pauses when the grid is offscreen or the tab is hidden.

const TILE_COUNT = 56
const SWAP_INTERVAL_MS = 750
const REFILL_THRESHOLD = 20
const BATCH_COUNT = 250

interface Tile {
  src: string
  fadeKey: number
}

const root = ref<HTMLElement | null>(null)
const tiles = ref<Tile[]>([])
const queue = ref<string[]>([])
const shown = new Set<string>()

let fadeCounter = 0
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
    fadeCounter++
    tiles.value[idx] = { src, fadeKey: fadeCounter }
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
    fadeCounter++
    initial.push({ src, fadeKey: fadeCounter })
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
      v-for="(tile, i) in tiles"
      :key="i"
      class="photogrid__cell"
    >
      <img
        :key="tile.fadeKey"
        :src="tile.src"
        alt=""
        loading="lazy"
        class="photogrid__img"
      >
    </div>
  </div>
</template>

<style scoped>
.photogrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  grid-auto-rows: 100px;
  gap: 2px;
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
  animation: photogrid-fade 0.6s ease;
}

@keyframes photogrid-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
