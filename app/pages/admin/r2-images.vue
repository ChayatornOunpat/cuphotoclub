<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'R2 Images' })

interface ImageUsage {
  kind: 'gallery' | 'hero' | 'post-cover' | 'event-cover' | 'member-photo' | 'editorial-album'
  label: string
  href?: string
  role?: string
}

interface R2Image {
  key: string
  contentType?: string
  size?: number
  uploadedAt?: string
  albums: ImageUsage[]
  usages: ImageUsage[]
}

interface R2Inventory {
  prefix: string
  total: number
  linkedToAlbums: number
  referenced: number
  images: R2Image[]
}

const prefixInput = ref('')
const activePrefix = ref('')
const statusFilter = ref<'all' | 'album' | 'referenced' | 'unlinked'>('all')
const search = ref('')

const { data, pending, error, refresh } = await useFetch<R2Inventory>('/api/admin/r2-images', {
  query: computed(() => ({ prefix: activePrefix.value || undefined }))
})

const images = computed(() => data.value?.images ?? [])
const filteredImages = computed(() => {
  const term = search.value.trim().toLowerCase()
  return images.value.filter((image) => {
    const hasAlbum = image.albums.length > 0
    const hasReference = hasAlbum || image.usages.length > 0
    if (statusFilter.value === 'album' && !hasAlbum) return false
    if (statusFilter.value === 'referenced' && !hasReference) return false
    if (statusFilter.value === 'unlinked' && hasReference) return false
    if (!term) return true
    const haystack = [
      image.key,
      ...image.albums.map(item => item.label),
      ...image.usages.map(item => item.label)
    ].join(' ').toLowerCase()
    return haystack.includes(term)
  })
})

const prefixOptions = computed(() => {
  const firstSegments = new Set(images.value.map(image => image.key.split('/')[0]).filter(Boolean))
  return [...firstSegments].sort((a, b) => a.localeCompare(b))
})

function applyPrefix(prefix = prefixInput.value) {
  activePrefix.value = prefix.trim().replace(/^\/+/, '')
  prefixInput.value = activePrefix.value
}

function clearPrefix() {
  prefixInput.value = ''
  applyPrefix('')
}

function formatBytes(value?: number) {
  if (!value) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let size = value
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`
}

function usageLabel(item: ImageUsage) {
  return item.role ? `${item.label} · ${item.role}` : item.label
}

const deletingKey = ref<string | null>(null)

async function requestDelete(key: string, force = false) {
  await $fetch('/api/admin/r2-images/delete', {
    method: 'POST',
    body: { key, force }
  })
}

async function deleteImage(image: R2Image, force = false) {
  deletingKey.value = image.key
  try {
    await requestDelete(image.key, force)
    await refresh()
  } catch (err: any) {
    if (err?.statusCode === 409 && !force) {
      if (confirm(`${err.data?.message || 'This image is still referenced elsewhere.'}\n\nDelete it anyway?`)) {
        await deleteImage(image, true)
        return
      }
    } else {
      alert(err?.data?.message || 'Could not delete image.')
    }
  } finally {
    deletingKey.value = null
  }
}

function confirmDelete(image: R2Image) {
  if (!confirm(`Delete "${image.key}" from R2? This cannot be undone.`)) return
  deleteImage(image)
}

// ── Bulk selection ───────────────────────────────────────────────────────
const selected = ref<Set<string>>(new Set())
const bulkDeleting = ref(false)
const lastSelectedIndex = ref<number | null>(null)

function isSelected(key: string) {
  return selected.value.has(key)
}
function selectionOrder(key: string) {
  const index = [...selected.value].indexOf(key)
  return index >= 0 ? index + 1 : null
}
function toggleSelected(key: string) {
  const next = new Set(selected.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  selected.value = next
}
function selectRange(fromIndex: number, toIndex: number) {
  const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex]
  const next = new Set(selected.value)
  for (let i = start; i <= end; i++) {
    const image = filteredImages.value[i]
    if (image) next.add(image.key)
  }
  selected.value = next
}
function onCheckboxClick(event: MouseEvent, key: string, index: number) {
  event.preventDefault()
  if (event.shiftKey && lastSelectedIndex.value !== null) {
    selectRange(lastSelectedIndex.value, index)
  } else {
    toggleSelected(key)
  }
  lastSelectedIndex.value = index
}
function clearSelection() {
  selected.value = new Set()
  lastSelectedIndex.value = null
}
const allFilteredSelected = computed(() =>
  filteredImages.value.length > 0 && filteredImages.value.every(image => selected.value.has(image.key))
)
function toggleSelectAllFiltered() {
  if (allFilteredSelected.value) {
    clearSelection()
  } else {
    selected.value = new Set(filteredImages.value.map(image => image.key))
  }
}

async function bulkDelete() {
  const keys = [...selected.value]
  if (!keys.length) return
  if (!confirm(`Delete ${keys.length} image${keys.length === 1 ? '' : 's'} from R2? This cannot be undone.`)) return

  bulkDeleting.value = true
  const blocked: string[] = []
  const failed: string[] = []
  try {
    for (const key of keys) {
      try {
        await requestDelete(key)
      } catch (err: any) {
        if (err?.statusCode === 409) blocked.push(key)
        else failed.push(key)
      }
    }

    if (blocked.length && confirm(
      `${blocked.length} of the selected images are still referenced elsewhere. Delete them anyway?`
    )) {
      for (const key of blocked) {
        try { await requestDelete(key, true) }
        catch { failed.push(key) }
      }
    }

    clearSelection()
    await refresh()

    if (failed.length) {
      alert(`Could not delete ${failed.length} image${failed.length === 1 ? '' : 's'}.`)
    }
  } finally {
    bulkDeleting.value = false
  }
}
</script>

<template>
  <div class="r2">
    <header class="r2__head">
      <div>
        <p class="r2__kicker">Admin inventory</p>
        <h1 class="r2__title">R2 Images</h1>
        <p class="r2__lead">Browse uploaded image objects and see which gallery albums or site surfaces still point to them.</p>
      </div>
      <button type="button" class="r2__refresh" :disabled="pending" @click="refresh">
        <Icon name="heroicons:arrow-path" />
        Refresh
      </button>
    </header>

    <section class="r2__stats" aria-label="R2 image summary">
      <div>
        <strong>{{ data?.total ?? 0 }}</strong>
        <span>Images</span>
      </div>
      <div>
        <strong>{{ data?.linkedToAlbums ?? 0 }}</strong>
        <span>In gallery albums</span>
      </div>
      <div>
        <strong>{{ data?.referenced ?? 0 }}</strong>
        <span>Referenced anywhere</span>
      </div>
      <div>
        <strong>{{ filteredImages.length }}</strong>
        <span>Shown</span>
      </div>
    </section>

    <section class="r2__tools" aria-label="R2 image filters">
      <form class="r2__prefix" @submit.prevent="applyPrefix()">
        <label for="prefix">Prefix</label>
        <input id="prefix" v-model="prefixInput" type="text" placeholder="photos/, hero, posts/covers">
        <button type="submit">Apply</button>
        <button v-if="activePrefix" type="button" @click="clearPrefix">Clear</button>
      </form>

      <div v-if="prefixOptions.length && !activePrefix" class="r2__chips">
        <button v-for="prefix in prefixOptions" :key="prefix" type="button" @click="applyPrefix(prefix)">
          {{ prefix }}
        </button>
      </div>

      <div class="r2__filters">
        <input v-model="search" type="search" placeholder="Search key or album">
        <select v-model="statusFilter">
          <option value="all">All images</option>
          <option value="album">Linked to gallery album</option>
          <option value="referenced">Referenced anywhere</option>
          <option value="unlinked">No known reference</option>
        </select>
      </div>
    </section>

    <p v-if="error" class="r2__error">Could not load R2 images.</p>
    <div v-else-if="pending" class="r2__empty">
      <UiSpinner />
      <span>Loading R2 images</span>
    </div>
    <div v-else-if="!filteredImages.length" class="r2__empty">No images match this view.</div>

    <template v-else>
      <div class="r2__bulk">
        <label class="r2__select-all">
          <input type="checkbox" :checked="allFilteredSelected" @change="toggleSelectAllFiltered">
          <span class="r2__select-box" aria-hidden="true" />
          <span>Select all shown</span>
        </label>
        <div v-if="selected.size" class="r2__bulk-actions">
          <span>{{ selected.size }} selected</span>
          <button type="button" class="r2__bulk-clear" @click="clearSelection">Clear</button>
          <button type="button" class="r2__bulk-delete" :disabled="bulkDeleting" @click="bulkDelete">
            <Icon name="heroicons:trash" />
            {{ bulkDeleting ? 'Deleting…' : `Delete ${selected.size}` }}
          </button>
        </div>
      </div>

      <section class="r2__list" aria-label="R2 image list">
        <article v-for="(image, index) in filteredImages" :key="image.key" class="image-row" :class="{ 'is-selected': isSelected(image.key) }">
          <div class="image-row__thumb">
            <label class="image-row__check">
              <input type="checkbox" :checked="isSelected(image.key)" @click="onCheckboxClick($event, image.key, index)">
              <span class="image-row__check-box" aria-hidden="true">
                {{ selectionOrder(image.key) || '' }}
              </span>
            </label>
            <a :href="`/images/${image.key}`" target="_blank" rel="noopener">
              <img :src="`/images/${image.key}`" alt="" loading="lazy">
            </a>
          </div>

          <div class="image-row__body">
            <div class="image-row__main">
              <div class="image-row__title">
                <h2>{{ image.key }}</h2>
                <button
                  type="button"
                  class="image-row__delete"
                  :disabled="deletingKey === image.key"
                  @click="confirmDelete(image)"
                >
                  <Icon name="heroicons:trash" />
                  {{ deletingKey === image.key ? 'Deleting…' : 'Delete' }}
                </button>
              </div>
              <dl>
                <div>
                  <dt>Type</dt>
                  <dd>{{ image.contentType || 'image' }}</dd>
                </div>
                <div>
                  <dt>Size</dt>
                  <dd>{{ formatBytes(image.size) }}</dd>
                </div>
                <div>
                  <dt>Uploaded</dt>
                  <dd>{{ formatDateTime(image.uploadedAt) }}</dd>
                </div>
              </dl>
            </div>

            <div class="image-row__refs">
              <div>
                <p>Gallery albums</p>
                <div v-if="image.albums.length" class="image-row__links">
                  <NuxtLink v-for="album in image.albums" :key="`${image.key}-${album.href}-${album.role}`" :to="album.href || '#'">
                    {{ usageLabel(album) }}
                  </NuxtLink>
                </div>
                <span v-else class="image-row__none">None</span>
              </div>

              <div>
                <p>Other references</p>
                <div v-if="image.usages.length" class="image-row__links">
                  <NuxtLink v-for="usage in image.usages" :key="`${image.key}-${usage.kind}-${usage.href}-${usage.role}`" :to="usage.href || '#'">
                    {{ usageLabel(usage) }}
                  </NuxtLink>
                </div>
                <span v-else class="image-row__none">None</span>
              </div>
            </div>
          </div>
        </article>
      </section>
    </template>
  </div>
</template>

<style scoped>
.r2 {
  max-width: 1180px;
  margin: 0 auto;
  padding: 3rem 2rem 5rem;
  display: grid;
  gap: 1.4rem;
}

.r2__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
}

.r2__kicker {
  margin-bottom: 0.7rem;
  color: var(--accent);
  font-size: 0.54rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.r2__title {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7vw, 6rem);
  line-height: 0.95;
  font-weight: 200;
  color: var(--dark);
}

.r2__lead {
  max-width: 560px;
  margin-top: 0.9rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.7;
}

.r2__refresh {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--dark);
  background: var(--dark);
  color: #F5F4F0;
  padding: 0.65rem 1rem;
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
}
.r2__refresh:hover { border-color: var(--accent); background: var(--accent); }
.r2__refresh:disabled { opacity: 0.55; cursor: wait; }
.r2__refresh svg { width: 1rem; height: 1rem; }

.r2__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 1px solid var(--subtle);
  border-bottom: 1px solid var(--subtle);
}

.r2__stats div {
  padding: 1.1rem 1.2rem 1.2rem;
  border-left: 1px solid var(--subtle);
}
.r2__stats div:first-child { border-left: 0; padding-left: 0; }
.r2__stats strong {
  display: block;
  font-family: var(--font-serif);
  font-size: 2.8rem;
  line-height: 0.9;
  font-weight: 200;
  color: var(--dark);
}
.r2__stats span {
  display: block;
  margin-top: 0.45rem;
  color: var(--muted);
  font-size: 0.55rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.r2__tools {
  display: grid;
  gap: 0.8rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--subtle);
}

.r2__prefix,
.r2__filters {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.r2__prefix label {
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}

.r2__prefix input,
.r2__filters input,
.r2__filters select {
  min-height: 2.35rem;
  border: 1px solid var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 60%, white);
  color: var(--dark);
  padding: 0 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.72rem;
}
.r2__prefix input,
.r2__filters input { min-width: min(28rem, 100%); flex: 1; }
.r2__filters select { min-width: 15rem; }

.r2__prefix button,
.r2__chips button {
  min-height: 2.35rem;
  border: 1px solid var(--subtle);
  background: none;
  color: var(--dark);
  padding: 0 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.r2__prefix button:hover,
.r2__chips button:hover { border-color: var(--accent); color: var(--accent); }

.r2__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}

.r2__error,
.r2__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  min-height: 12rem;
  border: 1px solid var(--subtle);
  background: var(--paper);
  color: var(--muted);
  font-size: 0.78rem;
}
.r2__error { color: #b0243c; }

.r2__bulk {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  padding: 0.2rem 0;
}

.r2__select-all {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--muted);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
}
.r2__select-all input,
.image-row__check input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
  pointer-events: none;
}
.r2__select-box {
  position: relative;
  width: 1.05rem;
  height: 1.05rem;
  flex: 0 0 auto;
  border: 1px solid var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 70%, white);
}
.r2__select-box::after {
  content: '';
  position: absolute;
  inset: 0.25rem;
  background: transparent;
}
.r2__select-all:hover .r2__select-box {
  border-color: var(--accent);
}
.r2__select-all input:focus-visible + .r2__select-box {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.r2__select-all input:checked + .r2__select-box {
  border-color: var(--accent);
  background: var(--accent);
}
.r2__select-all input:checked + .r2__select-box::after {
  background: #F5F4F0;
}

.r2__bulk-actions {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.68rem;
  color: var(--dark);
}

.r2__bulk-clear {
  border: none;
  background: none;
  color: var(--muted);
  text-decoration: underline;
  font-size: 0.62rem;
  cursor: pointer;
}
.r2__bulk-clear:hover { color: var(--dark); }

.r2__bulk-delete {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid #b0243c;
  background: #b0243c;
  color: #F5F4F0;
  padding: 0.5rem 0.9rem;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.r2__bulk-delete:hover { background: #8f1c30; border-color: #8f1c30; }
.r2__bulk-delete:disabled { opacity: 0.55; cursor: wait; }
.r2__bulk-delete svg { width: 0.85rem; height: 0.85rem; }

.r2__list {
  display: grid;
  gap: 1px;
  background: var(--subtle);
  border: 1px solid var(--subtle);
}

.image-row {
  display: grid;
  grid-template-columns: 13rem minmax(0, 1fr);
  background: var(--body-bg);
  position: relative;
  transition: background 0.15s;
}

.image-row__thumb {
  position: relative;
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: var(--paper);
}
.image-row__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: opacity 0.15s, transform 0.15s;
}
.image-row__check {
  position: absolute;
  top: 0.55rem;
  left: 0.55rem;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 1.65rem;
  height: 1.65rem;
  cursor: pointer;
}
.image-row__check-box {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border: 1px solid rgba(245, 244, 240, 0.78);
  background: rgba(12, 12, 10, 0.56);
  color: #F5F4F0;
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 600;
  line-height: 1;
  backdrop-filter: blur(4px);
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.image-row__check:hover .image-row__check-box {
  border-color: #F5F4F0;
  background: rgba(12, 12, 10, 0.72);
}
.image-row__check input:focus-visible + .image-row__check-box {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.image-row.is-selected {
  background: color-mix(in srgb, var(--accent) 5%, var(--body-bg));
  outline: 2.5px solid var(--accent);
  outline-offset: -2px;
}
.image-row.is-selected .image-row__thumb::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2.5px solid var(--accent);
  pointer-events: none;
}
.image-row.is-selected .image-row__thumb img {
  opacity: 0.62;
}
.image-row.is-selected .image-row__check-box {
  border-color: var(--accent);
  background: var(--accent);
  color: #fff;
}

.image-row__body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.8fr);
  gap: 1.2rem;
  padding: 1rem;
  min-width: 0;
}

.image-row__main,
.image-row__refs {
  min-width: 0;
}

.image-row__title {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.9rem;
}

.image-row__main h2 {
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.image-row__delete {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  flex-shrink: 0;
  border: 1px solid var(--subtle);
  background: none;
  color: #b0243c;
  padding: 0.35rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.image-row__delete:hover { border-color: #b0243c; background: color-mix(in srgb, #b0243c 8%, transparent); }
.image-row__delete:disabled { opacity: 0.55; cursor: wait; }
.image-row__delete svg { width: 0.8rem; height: 0.8rem; }

.image-row__main dl {
  display: flex;
  flex-wrap: wrap;
  gap: 0.8rem 1.3rem;
  margin: 0;
}
.image-row__main div { min-width: 5.5rem; }
.image-row__main dt,
.image-row__refs p {
  margin-bottom: 0.25rem;
  color: var(--muted);
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.image-row__main dd {
  margin: 0;
  color: var(--dark);
  font-size: 0.68rem;
}

.image-row__refs {
  display: grid;
  gap: 0.8rem;
  align-content: start;
}

.image-row__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.image-row__links a,
.image-row__none {
  display: inline-flex;
  max-width: 100%;
  border: 1px solid var(--subtle);
  padding: 0.35rem 0.5rem;
  color: var(--dark);
  text-decoration: none;
  font-size: 0.62rem;
  line-height: 1.35;
  overflow-wrap: anywhere;
}
.image-row__links a:hover { border-color: var(--accent); color: var(--accent); }
.image-row__none { color: var(--muted); }

@media (max-width: 900px) {
  .r2 { padding: 2rem 1.25rem 4rem; }
  .r2__head { flex-direction: column; }
  .r2__stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .r2__stats div:nth-child(odd) { border-left: 0; padding-left: 0; }
  .image-row,
  .image-row__body { grid-template-columns: 1fr; }
  .image-row__thumb { aspect-ratio: 16 / 9; }
}

@media (max-width: 560px) {
  .r2__stats { grid-template-columns: 1fr; }
  .r2__stats div {
    border-left: 0;
    border-top: 1px solid var(--subtle);
    padding-left: 0;
  }
  .r2__stats div:first-child { border-top: 0; }
  .r2__prefix input,
  .r2__filters input,
  .r2__filters select { min-width: 100%; }
}
</style>
