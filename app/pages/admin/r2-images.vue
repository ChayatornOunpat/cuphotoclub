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

    <section v-else class="r2__list" aria-label="R2 image list">
      <article v-for="image in filteredImages" :key="image.key" class="image-row">
        <a class="image-row__thumb" :href="`/images/${image.key}`" target="_blank" rel="noopener">
          <img :src="`/images/${image.key}`" alt="" loading="lazy">
        </a>

        <div class="image-row__body">
          <div class="image-row__main">
            <h2>{{ image.key }}</h2>
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
}

.image-row__thumb {
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

.image-row__main h2 {
  margin-bottom: 0.9rem;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 500;
  line-height: 1.45;
  overflow-wrap: anywhere;
}

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
