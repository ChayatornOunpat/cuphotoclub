<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Image Lab — Admin' })

// ── Settings ─────────────────────────────────────────────────────────────
const maxDim   = ref(1920)
const quality  = ref(0.88)
const format   = ref<'image/jpeg' | 'image/webp'>('image/jpeg')

// ── Source ───────────────────────────────────────────────────────────────
const original = ref<{ blob: Blob; url: string; w: number; h: number } | null>(null)
const compressed = ref<{ blob: Blob; url: string; w: number; h: number } | null>(null)
const compressing = ref(false)
const dragOver = ref(false)
const fileInput = ref<HTMLInputElement>()

// ── Comparison slider ────────────────────────────────────────────────────
const dividerPct = ref(50)
const draggingDivider = ref(false)
const viewerEl = ref<HTMLElement>()

function onDividerPointerDown(e: PointerEvent) {
  e.preventDefault()
  draggingDivider.value = true
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}
function onDividerPointerMove(e: PointerEvent) {
  if (!draggingDivider.value || !viewerEl.value) return
  const { left, width } = viewerEl.value.getBoundingClientRect()
  dividerPct.value = Math.min(98, Math.max(2, ((e.clientX - left) / width) * 100))
}
function onDividerPointerUp() { draggingDivider.value = false }

// ── Zoom & pan ───────────────────────────────────────────────────────────
// Both layers share one transform so the two images stay pixel-aligned; the
// clip-path that splits them lives on the wrapper, which is never transformed,
// so the divider stays put in screen space while the images zoom underneath.
const MIN_ZOOM = 1
const MAX_ZOOM = 12
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const panning = ref(false)
let panStart = { x: 0, y: 0, panX: 0, panY: 0 }

const imgTransform = computed(() => `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`)
const zoomPct = computed(() => Math.round(zoom.value * 100))
// Past a couple of stops, browser smoothing hides exactly the JPEG/WebP
// artefacts this page exists to show. Render real pixels instead.
const pixelated = computed(() => zoom.value >= 2)

// The scale object-fit:contain already applies at zoom 1 — the bridge between
// on-screen pixels and the image's own pixels.
function fitScale() {
  const el = viewerEl.value
  if (!el || !original.value) return 1
  const r = el.getBoundingClientRect()
  return Math.min(r.width / original.value.w, r.height / original.value.h)
}

// Never let the image be dragged clear of the frame; at fit there is no slack.
function clampPan() {
  const el = viewerEl.value
  if (!el || !original.value) return
  const r = el.getBoundingClientRect()
  const s = fitScale() * zoom.value
  const maxX = Math.max(0, (original.value.w * s - r.width) / 2)
  const maxY = Math.max(0, (original.value.h * s - r.height) / 2)
  panX.value = Math.min(maxX, Math.max(-maxX, panX.value))
  panY.value = Math.min(maxY, Math.max(-maxY, panY.value))
}

// Zoom about a point given relative to the viewer centre, so whatever sits
// under the cursor stays under the cursor.
function setZoom(next: number, originX = 0, originY = 0) {
  const z0 = zoom.value
  const z1 = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next))
  if (z1 === z0) return
  panX.value = originX - (z1 / z0) * (originX - panX.value)
  panY.value = originY - (z1 / z0) * (originY - panY.value)
  zoom.value = z1
  clampPan()
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

// 1:1 — one image pixel per screen pixel, the level worth judging artefacts at.
function zoomToActual() {
  const s = fitScale()
  if (s > 0) setZoom(1 / s)
}

function onWheel(e: WheelEvent) {
  if (!viewerEl.value) return
  e.preventDefault()
  const r = viewerEl.value.getBoundingClientRect()
  setZoom(
    zoom.value * (e.deltaY < 0 ? 1.15 : 1 / 1.15),
    e.clientX - r.left - r.width / 2,
    e.clientY - r.top - r.height / 2
  )
}

function onViewerPointerDown(e: PointerEvent) {
  // The divider's own handler runs first and bubbles here; don't also pan.
  if (draggingDivider.value || zoom.value <= 1) return
  panning.value = true
  panStart = { x: e.clientX, y: e.clientY, panX: panX.value, panY: panY.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onViewerPointerMove(e: PointerEvent) {
  if (draggingDivider.value) { onDividerPointerMove(e); return }
  if (!panning.value) return
  panX.value = panStart.panX + (e.clientX - panStart.x)
  panY.value = panStart.panY + (e.clientY - panStart.y)
  clampPan()
}
function onViewerPointerUp() {
  onDividerPointerUp()
  panning.value = false
}

// ── Compress ─────────────────────────────────────────────────────────────
async function compress(src: Blob): Promise<{ blob: Blob; url: string; w: number; h: number }> {
  const bmp = await createImageBitmap(src)
  let w = bmp.width, h = bmp.height
  if (w > maxDim.value || h > maxDim.value) {
    if (w >= h) { h = Math.round(h * maxDim.value / w); w = maxDim.value }
    else        { w = Math.round(w * maxDim.value / h); h = maxDim.value }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), format.value, quality.value)
  )
  return { blob, url: URL.createObjectURL(blob), w, h }
}

async function runCompress() {
  if (!original.value) return
  compressing.value = true
  if (compressed.value) URL.revokeObjectURL(compressed.value.url)
  try { compressed.value = await compress(original.value.blob) }
  finally { compressing.value = false }
}

async function loadFile(file: File) {
  if (!file.type.startsWith('image/')) return
  if (original.value) URL.revokeObjectURL(original.value.url)
  if (compressed.value) { URL.revokeObjectURL(compressed.value.url); compressed.value = null }
  const bmp = await createImageBitmap(file)
  original.value = { blob: file, url: URL.createObjectURL(file), w: bmp.width, h: bmp.height }
  bmp.close()
  dividerPct.value = 50
  resetView()
  await runCompress()
}

function onPick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) loadFile(f)
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) loadFile(f)
}

watch([maxDim, quality, format], () => { if (original.value) runCompress() })

onUnmounted(() => {
  if (original.value) URL.revokeObjectURL(original.value.url)
  if (compressed.value) URL.revokeObjectURL(compressed.value.url)
})

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtSize(bytes: number) {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB`
  return `${(bytes / 1_000).toFixed(0)} KB`
}
function savings(orig: number, comp: number) {
  return Math.round((1 - comp / orig) * 100)
}

function downloadCompressed() {
  if (!compressed.value) return
  const ext = format.value === 'image/webp' ? 'webp' : 'jpg'
  const a = document.createElement('a')
  a.href = compressed.value.url
  a.download = `compressed.${ext}`
  a.click()
}
</script>

<template>
  <div class="lab">
    <header class="lab__head">
      <h1 class="lab__title">Image Lab</h1>
      <p class="lab__sub">Test compression settings before applying them to the uploader.</p>
    </header>

    <!-- Settings bar -->
    <div class="lab__settings">
      <div class="setting">
        <label class="setting__label">Max dimension</label>
        <div class="setting__row">
          <input v-model.number="maxDim" type="range" min="480" max="3840" step="80" class="setting__range">
          <span class="setting__val">{{ maxDim }}px</span>
        </div>
      </div>
      <div class="setting">
        <label class="setting__label">Quality</label>
        <div class="setting__row">
          <input v-model.number="quality" type="range" min="0.5" max="1" step="0.01" class="setting__range">
          <span class="setting__val">{{ Math.round(quality * 100) }}%</span>
        </div>
      </div>
      <div class="setting">
        <label class="setting__label">Format</label>
        <div class="setting__toggle">
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: format === 'image/jpeg' }"
            @click="format = 'image/jpeg'"
          >JPEG</button>
          <button
            type="button"
            class="toggle-btn"
            :class="{ active: format === 'image/webp' }"
            @click="format = 'image/webp'"
          >WebP</button>
        </div>
      </div>
    </div>

    <!-- Stats bar -->
    <div v-if="original" class="lab__stats">
      <div class="stat-block">
        <span class="stat-block__label">Original</span>
        <span class="stat-block__val">{{ fmtSize(original.blob.size) }}</span>
        <span class="stat-block__dim">{{ original.w }} × {{ original.h }}</span>
      </div>
      <div class="stat-sep">→</div>
      <div class="stat-block">
        <span class="stat-block__label">Compressed</span>
        <span class="stat-block__val" :class="compressing ? 'is-muted' : ''">
          {{ compressed ? fmtSize(compressed.blob.size) : '—' }}
        </span>
        <span class="stat-block__dim">
          {{ compressed ? `${compressed.w} × ${compressed.h}` : '—' }}
        </span>
      </div>
      <div v-if="compressed" class="stat-savings">
        <span class="stat-savings__pct">−{{ savings(original.blob.size, compressed.blob.size) }}%</span>
        <span class="stat-savings__label">smaller</span>
      </div>
      <button v-if="compressed" type="button" class="lab__download" @click="downloadCompressed">
        Download compressed
      </button>
    </div>

    <!-- Comparison viewer -->
    <div
      v-if="original && compressed"
      ref="viewerEl"
      class="lab__viewer"
      :class="{ 'is-dragging': draggingDivider, 'is-zoomed': zoom > 1, 'is-panning': panning }"
      @pointerdown="onViewerPointerDown"
      @pointermove="onViewerPointerMove"
      @pointerup="onViewerPointerUp"
      @pointercancel="onViewerPointerUp"
      @wheel="onWheel"
    >
      <!-- Compressed (full, behind) — revealed on the right of the divider. -->
      <div class="viewer__layer viewer__layer--base">
        <img
          :src="compressed.url"
          alt="Compressed"
          class="viewer__img"
          :class="{ 'is-pixelated': pixelated }"
          :style="{ transform: imgTransform }"
        >
      </div>

      <!-- Original on top, clipped to the LEFT of the divider so the sides match
           the labels. inset(0 R 0 0) pulls the *right* edge in, so whatever sits
           in this layer is what you see on the left. The clip is on the layer,
           not the image, so zooming never drags the split line with it. -->
      <div class="viewer__layer viewer__layer--top" :style="{ clipPath: `inset(0 ${100 - dividerPct}% 0 0)` }">
        <img
          :src="original.url"
          alt="Original"
          class="viewer__img"
          :class="{ 'is-pixelated': pixelated }"
          :style="{ transform: imgTransform }"
        >
      </div>
      <div v-if="compressing" class="viewer__compressing">Compressing…</div>

      <!-- Zoom controls -->
      <div class="viewer__zoom" @pointerdown.stop>
        <button type="button" class="zoom-btn" title="Zoom out" @click="setZoom(zoom / 1.4)">−</button>
        <span class="zoom-pct">{{ zoomPct }}%</span>
        <button type="button" class="zoom-btn" title="Zoom in" @click="setZoom(zoom * 1.4)">+</button>
        <span class="zoom-sep" />
        <button type="button" class="zoom-btn zoom-btn--wide" :class="{ active: zoom === 1 }" @click="resetView">Fit</button>
        <button type="button" class="zoom-btn zoom-btn--wide" @click="zoomToActual">1:1</button>
      </div>

      <!-- Labels -->
      <span class="viewer__label viewer__label--left">Original</span>
      <span class="viewer__label viewer__label--right">Compressed</span>

      <!-- Divider -->
      <div
        class="viewer__divider"
        :style="{ left: dividerPct + '%' }"
        @pointerdown="onDividerPointerDown"
      >
        <div class="viewer__handle">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 5l-4 5 4 5M13 5l4 5-4 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="square"/>
          </svg>
        </div>
      </div>
    </div>

    <!-- Drop zone (no image yet) -->
    <div
      v-else
      class="lab__drop"
      :class="{ 'is-drag-over': dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
      @click="fileInput?.click()"
    >
      <svg class="drop__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="0" />
        <polyline points="3 15 8 10 12 14 16 10 21 15" />
        <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
      </svg>
      <p class="drop__label">Drop an image here or <button type="button" class="drop__pick" @click.stop="fileInput?.click()">browse</button></p>
      <p class="drop__hint">Any size · JPG · PNG · WebP · HEIC</p>
    </div>

    <input ref="fileInput" type="file" accept="image/*" class="lab__input" @change="onPick">

    <!-- Replace button when image is loaded -->
    <div v-if="original" class="lab__replace">
      <button type="button" class="btn-ghost" @click="fileInput?.click()">Replace image</button>
    </div>
  </div>
</template>

<style scoped>
.lab {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

/* ── Header ── */
.lab__head { display: flex; flex-direction: column; gap: 0.3rem; }
.lab__title {
  font-family: var(--font-serif);
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  font-weight: 200;
  letter-spacing: -0.02em;
  color: var(--dark);
}
.lab__sub {
  font-size: 0.7rem;
  color: var(--muted);
}

/* ── Settings ── */
.lab__settings {
  display: flex;
  gap: 2rem;
  align-items: flex-end;
  padding: 1rem 1.1rem;
  border: 1px solid var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 60%, white);
  flex-wrap: wrap;
}
.setting { display: flex; flex-direction: column; gap: 0.4rem; flex: 1; min-width: 10rem; }
.setting__label {
  font-size: 0.44rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}
.setting__row { display: flex; align-items: center; gap: 0.65rem; }
.setting__range {
  flex: 1;
  accent-color: var(--accent);
  cursor: pointer;
}
.setting__val {
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
  color: var(--dark);
  min-width: 3.4rem;
  text-align: right;
}
.setting__toggle { display: flex; }
.toggle-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--subtle);
  background: none;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
  margin-left: -1px;
}
.toggle-btn.active {
  background: var(--dark);
  color: #F5F4F0;
  border-color: var(--dark);
  z-index: 1;
}

/* ── Stats ── */
.lab__stats {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 0.8rem 1.1rem;
  border: 1px solid var(--subtle);
  flex-wrap: wrap;
}
.stat-block { display: flex; flex-direction: column; gap: 0.15rem; }
.stat-block__label {
  font-size: 0.42rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}
.stat-block__val {
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 300;
  color: var(--dark);
  font-variant-numeric: tabular-nums;
}
.stat-block__val.is-muted { color: var(--muted); }
.stat-block__dim {
  font-size: 0.52rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}
.stat-sep { font-size: 1rem; color: var(--muted); font-weight: 200; }

.stat-savings {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  margin-left: auto;
}
.stat-savings__pct {
  font-size: 1.6rem;
  font-weight: 200;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}
.stat-savings__label {
  font-size: 0.42rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.lab__download {
  border: 1px solid var(--subtle);
  background: none;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s, color 0.15s;
}
.lab__download:hover { border-color: var(--accent); color: var(--accent); }

/* ── Comparison viewer ── */
.lab__viewer {
  position: relative;
  width: 100%;
  aspect-ratio: unset;
  overflow: hidden;
  border: 1px solid var(--subtle);
  user-select: none;
  background: var(--dark);
  cursor: col-resize;
  min-height: 320px;
  max-height: 72vh;
}
.lab__viewer.is-dragging { cursor: col-resize; }
.lab__viewer.is-zoomed { cursor: grab; }
.lab__viewer.is-panning { cursor: grabbing; }

/* Untransformed wrapper: carries the clip-path that splits the comparison, so
   the divider holds its screen position while the image zooms inside it. */
.viewer__layer {
  position: absolute;
  inset: 0;
  overflow: hidden;
}
.viewer__layer--base { z-index: 1; }
.viewer__layer--top  { z-index: 2; }

.viewer__img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  position: absolute;
  inset: 0;
  transform-origin: center center;
  will-change: transform;
}
/* Browser smoothing at high zoom hides the very artefacts under test. */
.viewer__img.is-pixelated { image-rendering: pixelated; }

.viewer__zoom {
  position: absolute;
  right: 0.65rem;
  bottom: 0.65rem;
  z-index: 12;
  display: flex;
  align-items: center;
  gap: 0.15rem;
  padding: 0.2rem;
  background: rgba(26, 25, 24, 0.72);
  cursor: default;
}
.zoom-btn {
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.3rem;
  border: none;
  background: transparent;
  color: #F5F4F0;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.zoom-btn:hover { background: rgba(245, 244, 240, 0.16); }
.zoom-btn.active { color: var(--accent); }
.zoom-btn--wide {
  font-size: 0.42rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.zoom-pct {
  min-width: 2.6rem;
  text-align: center;
  font-family: var(--font-sans);
  font-size: 0.42rem;
  letter-spacing: 0.1em;
  color: #F5F4F0;
  font-variant-numeric: tabular-nums;
}
.zoom-sep {
  width: 1px;
  height: 0.9rem;
  margin: 0 0.2rem;
  background: rgba(245, 244, 240, 0.28);
}

.viewer__compressing {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 25, 24, 0.45);
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #F5F4F0;
}

.viewer__label {
  position: absolute;
  top: 0.65rem;
  z-index: 5;
  font-family: var(--font-sans);
  font-size: 0.42rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  background: rgba(26, 25, 24, 0.55);
  color: #F5F4F0;
  padding: 0.2rem 0.45rem;
  pointer-events: none;
}
.viewer__label--left  { left: 0.65rem; }
.viewer__label--right { right: 0.65rem; }

.viewer__divider {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #F5F4F0;
  z-index: 10;
  transform: translateX(-1px);
  cursor: col-resize;
}
.viewer__handle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 2.4rem;
  height: 2.4rem;
  background: #F5F4F0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(26, 25, 24, 0.3);
  color: var(--dark);
}

/* ── Drop zone ── */
.lab__drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 4rem 2rem;
  border: 1px dashed var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 60%, white);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  min-height: 20rem;
}
.lab__drop:hover,
.lab__drop.is-drag-over {
  border-color: var(--accent);
  border-style: solid;
  background: color-mix(in srgb, var(--accent) 4%, white);
}
.drop__icon {
  width: 2.8rem;
  height: 2.8rem;
  color: var(--muted);
}
.drop__label { font-size: 0.78rem; color: var(--muted); }
.drop__pick {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.drop__hint {
  font-size: 0.48rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.65;
}

.lab__input { display: none; }

/* ── Replace ── */
.lab__replace { display: flex; }
.btn-ghost {
  border: 1px solid var(--subtle);
  background: none;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  padding: 0.5rem 0.9rem;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
</style>
