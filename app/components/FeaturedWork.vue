<script setup lang="ts">
interface Album {
  title: string
  category: string
  cover: string
  path: string
}

const props = defineProps<{
  albums: Album[]
  seed: number
}>()
const { t } = useI18n()

// Each unit spans all 4 columns and is itself a perfect rectangle of height `h`
// (its tile areas exactly fill 4 cols × h rows). Stacking any set of them yields
// a complete rectangle — flush bottom edge, no holes — for ANY album count.
// slots: c=startCol(1-4), r=startRow(1-based within unit), cs=colSpan, rs=rowSpan
interface Slot { c: number, r: number, cs?: number, rs?: number }
const UNITS: { h: number, slots: Slot[] }[] = [
  // height-1 bands (slot areas sum to 4)
  { h: 1, slots: [{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1 }, { c: 4, r: 1 }] },
  { h: 1, slots: [{ c: 1, r: 1, cs: 2 }, { c: 3, r: 1, cs: 2 }] },
  { h: 1, slots: [{ c: 1, r: 1, cs: 2 }, { c: 3, r: 1 }, { c: 4, r: 1 }] },
  { h: 1, slots: [{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1, cs: 2 }] },
  // height-2 bands (slot areas sum to 8)
  { h: 2, slots: [{ c: 1, r: 1, cs: 2, rs: 2 }, { c: 3, r: 1 }, { c: 4, r: 1 }, { c: 3, r: 2, cs: 2 }] },
  { h: 2, slots: [{ c: 1, r: 1 }, { c: 2, r: 1 }, { c: 3, r: 1, cs: 2, rs: 2 }, { c: 1, r: 2, cs: 2 }] },
  { h: 2, slots: [{ c: 1, r: 1, rs: 2 }, { c: 2, r: 1, cs: 2, rs: 2 }, { c: 4, r: 1, rs: 2 }] },
  { h: 2, slots: [{ c: 1, r: 1, cs: 2, rs: 2 }, { c: 3, r: 1, rs: 2 }, { c: 4, r: 1, rs: 2 }] },
  { h: 2, slots: [{ c: 1, r: 1, rs: 2 }, { c: 2, r: 1, rs: 2 }, { c: 3, r: 1, cs: 2, rs: 2 }] }
]

// Seeded PRNG (mulberry32). Same seed → same sequence on server and client,
// which keeps the SSR markup and the hydrated markup identical.
function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Tile extends Album { col: string, row: string }

const tiles = computed<Tile[]>(() => {
  const rand = mulberry32(props.seed)
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = arr.slice()
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[a[i], a[j]] = [a[j]!, a[i]!]
    }
    return a
  }

  const pool = shuffle(props.albums)
  if (pool.length < 2) {
    // Trivial cases still tile cleanly (single full-width / nothing).
    return pool.map(a => ({ ...a, col: '1 / span 4', row: '1 / span 1' }))
  }

  // Pick how many to show: a little variety, capped at what we have.
  const maxN = Math.min(pool.length, 12)
  const minN = Math.min(8, maxN)
  const count = minN + Math.floor(rand() * (maxN - minN + 1))
  const picks = pool.slice(0, count)

  // Choose a random set of units whose slot counts sum EXACTLY to `count`.
  const decompose = (n: number): { h: number, slots: Slot[] }[] | null => {
    if (n === 0) return []
    for (const u of shuffle(UNITS)) {
      if (u.slots.length <= n) {
        const rest = decompose(n - u.slots.length)
        if (rest) return [u, ...rest]
      }
    }
    return null
  }
  const units = decompose(count) ?? []

  const out: Tile[] = []
  let baseRow = 1
  let idx = 0
  for (const u of units) {
    for (const s of u.slots) {
      const a = picks[idx++]!
      out.push({
        ...a,
        col: `${s.c} / span ${s.cs ?? 1}`,
        row: `${baseRow + s.r - 1} / span ${s.rs ?? 1}`
      })
    }
    baseRow += u.h
  }
  return out
})
</script>

<template>
  <section id="gallery" class="section-pad gallery">
    <div class="wrap">
      <div class="eyebrow"><span class="num">01</span> {{ t('home.featuredWork') }}</div>
      <div class="gallery__wall">
        <NuxtLink
          v-for="tile in tiles"
          :key="tile.path + tile.col + tile.row"
          :to="tile.path"
          class="gitem"
          :style="{ gridColumn: tile.col, gridRow: tile.row }"
        >
          <AppImg :src="tile.cover" :alt="tile.title" sizes="sm:50vw md:33vw lg:25vw" />
          <span class="gitem__label">{{ tile.title }} · {{ tile.category }}</span>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gallery { background: var(--body-bg); }

/* 4-col grid; tiles placed explicitly (from the unit engine) so the wall is
   always a complete rectangle. */
.gallery__wall {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  grid-auto-rows: 210px;
  gap: 0.5rem;
}

.gitem {
  overflow: hidden;
  position: relative;
  cursor: pointer;
  display: block;
}
.gitem :deep(img) {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  transition: opacity 0.3s;
}

.gitem__label {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  padding: 2rem 1rem 0.85rem;
  background: linear-gradient(transparent, rgba(12, 12, 10, 0.75));
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: rgba(245, 244, 240, 0.85);
  opacity: 0;
  transition: opacity 0.28s;
}
.gitem:hover .gitem__label { opacity: 1; }

/* Below the 4-col engine width, fall back to a clean uniform grid. */
@media (max-width: 900px) {
  .gallery__wall { grid-template-columns: repeat(2, 1fr); grid-auto-rows: 200px; }
  .gitem { grid-column: auto !important; grid-row: auto !important; }
}
@media (max-width: 540px) {
  .gallery__wall { grid-template-columns: 1fr; grid-auto-rows: 220px; }
}
</style>
