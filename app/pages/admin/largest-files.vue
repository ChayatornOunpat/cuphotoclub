<script setup lang="ts">
import { isPrivateR2Key } from '~~/shared/r2Prefixes'

definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()

interface ImageUsage {
  kind: string
  label: string
  href?: string
  role?: string
}
interface LargestFile {
  key: string
  size: number
  contentType?: string
  uploadedAt: string
  albums: ImageUsage[]
  usages: ImageUsage[]
  referenced: boolean
}
interface LargestResponse {
  indexReady: boolean
  limit: number
  files: LargestFile[]
  totalCount: number
  totalBytes: number
  shownBytes: number
}

const limit = ref(25)
const sort = ref<'size' | 'unused'>('size')
const selected = ref<string[]>([])

const { data, pending, error, refresh } = await useFetch<LargestResponse>('/api/admin/largest-files', {
  query: computed(() => ({ limit: limit.value })),
  lazy: true
})

// /images/ 404s the private prefix by design, so those rows have to come from
// the authenticated route instead. Public-prefix keys keep using /images/ —
// it is edge-cached, so the Worker doesn't stream every thumbnail itself.
function fileUrl(key: string) {
  return isPrivateR2Key(key)
    ? `/api/admin/r2-images/preview?key=${encodeURIComponent(key)}`
    : `/images/${key}`
}

const files = computed(() => {
  const rows = data.value?.files ?? []
  // The server already sorts by size; "unused first" only regroups them.
  return sort.value === 'unused'
    ? [...rows].sort((a, b) => Number(a.referenced) - Number(b.referenced))
    : rows
})

const selectedBytes = computed(() =>
  (data.value?.files ?? []).filter(file => selected.value.includes(file.key)).reduce((sum, file) => sum + file.size, 0))

function toggle(key: string) {
  selected.value = selected.value.includes(key)
    ? selected.value.filter(item => item !== key)
    : [...selected.value, key]
}

function fmtBytes(bytes: number): string {
  if (!bytes) return '0 KB'
  const mb = bytes / 1e6
  if (mb < 1) return `${Math.max(1, Math.round(bytes / 1e3))} KB`
  if (mb < 1000) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`
  return `${(bytes / 1e9).toFixed(2)} GB`
}
function fmtNum(n: number): string {
  return (n ?? 0).toLocaleString('en-US')
}
function shortKey(key: string): string {
  const name = key.split('/').pop() ?? key
  return name.length > 34 ? `…${name.slice(-30)}` : name
}
function folderOf(key: string): string {
  const parts = key.split('/')
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '(root)'
}
function fileType(contentType?: string): string {
  return (contentType?.split('/')[1] ?? '').toUpperCase() || '—'
}

// ── Viewer ─────────────────────────────────────────────────────────────────
const viewing = ref<LargestFile | null>(null)
const viewIndex = computed(() => files.value.findIndex(file => file.key === viewing.value?.key))
function step(delta: number) {
  const next = files.value[viewIndex.value + delta]
  if (next) viewing.value = next
}
function onKey(event: KeyboardEvent) {
  if (!viewing.value) return
  if (event.key === 'Escape') viewing.value = null
  if (event.key === 'ArrowLeft') step(-1)
  if (event.key === 'ArrowRight') step(1)
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ── Download ───────────────────────────────────────────────────────────────
// Yesterday's migration re-encoded the old JPEGs as WebP in place, so a
// converted object keeps its .jpg key while holding WebP bytes (that is what
// let it skip repointing every album and hero slot). Downloading therefore
// needs two things: a name matching what the bytes actually are, and — for
// anything that still wants a JPEG — a re-encode.
//
// The re-encode runs here in the browser, through a canvas: Workers cannot
// encode images, and Cloudflare's transform service both costs quota and
// cannot reach the private contributions/ prefix. It is lossy (WebP → JPEG is
// a second generation) and usually produces a LARGER file, so it is offered
// beside the untouched original rather than instead of it.
const JPEG_QUALITY = 0.92
const downloading = ref('')

function baseName(key: string) {
  return (key.split('/').pop() ?? key).replace(/\.[^.]+$/, '')
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function downloadOriginal(file: LargestFile) {
  downloading.value = file.key
  try {
    const blob = await $fetch<Blob>(fileUrl(file.key), { responseType: 'blob' })
    // Name it after the real type, not the key's (possibly stale) extension.
    const ext = (blob.type || file.contentType || '').split('/')[1] || 'bin'
    save(blob, `${baseName(file.key)}.${ext === 'jpeg' ? 'jpg' : ext}`)
  } catch {
    notice.value = t('adminLargest.downloadFailed')
  } finally {
    downloading.value = ''
  }
}

async function downloadAsJpeg(file: LargestFile) {
  downloading.value = file.key
  try {
    const image = new Image()
    image.src = fileUrl(file.key)
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('no 2d context')
    // JPEG has no alpha; without this, transparent pixels turn black.
    context.fillStyle = '#FFFFFF'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) throw new Error('encode failed')
    save(blob, `${baseName(file.key)}.jpg`)
  } catch {
    notice.value = t('adminLargest.downloadFailed')
  } finally {
    downloading.value = ''
  }
}

// ── Trash ──────────────────────────────────────────────────────────────────
interface TrashResult { items: { key: string, status: 'trashed' | 'blocked', referenced: boolean }[] }
const working = ref(false)
const notice = ref('')
// Files the server refused because something still points at them; trashing
// them anyway also scrubs those references, so it asks first.
const blocked = ref<string[]>([])

async function trash(keys: string[], force = false) {
  if (!keys.length || working.value) return
  working.value = true
  notice.value = ''
  try {
    const result = await $fetch<TrashResult>('/api/admin/r2-images/trash-session', {
      method: 'POST',
      body: { keys, force }
    })
    const trashed = result.items.filter(item => item.status === 'trashed').map(item => item.key)
    blocked.value = result.items.filter(item => item.status === 'blocked').map(item => item.key)
    selected.value = selected.value.filter(key => !trashed.includes(key))
    if (viewing.value && trashed.includes(viewing.value.key)) viewing.value = null
    if (trashed.length) notice.value = t('adminLargest.trashed', { count: fmtNum(trashed.length) })
    await refresh()
  } catch {
    notice.value = t('adminLargest.trashFailed')
  } finally {
    working.value = false
  }
}
</script>

<template>
  <div class="lf">
    <header class="lf__head">
      <div>
        <NuxtLink :to="localePath('/admin/cost')" class="lf__back">{{ t('adminLargest.back') }}</NuxtLink>
        <h1 class="lf__title">{{ t('adminLargest.title') }}</h1>
        <p class="lf__lead">{{ t('adminLargest.lead') }}</p>
      </div>
      <button type="button" class="lf__refresh" :disabled="pending || working" @click="refresh()">
        {{ t('adminLargest.refresh') }}
      </button>
    </header>

    <p v-if="data && !data.indexReady" class="lf__notice">{{ t('adminLargest.indexStale') }}</p>
    <p v-if="notice" class="lf__notice">{{ notice }}</p>

    <div v-if="data" class="lf__bar">
      <p class="lf__stat">
        {{ t('adminLargest.summary', {
          shown: fmtNum(files.length),
          total: fmtNum(data.totalCount),
          shownSize: fmtBytes(data.shownBytes),
          totalSize: fmtBytes(data.totalBytes)
        }) }}
      </p>
      <div class="lf__controls">
        <div class="lf__tabs">
          <button type="button" :class="{ 'is-active': sort === 'size' }" @click="sort = 'size'">{{ t('adminLargest.sortSize') }}</button>
          <button type="button" :class="{ 'is-active': sort === 'unused' }" @click="sort = 'unused'">{{ t('adminLargest.sortUnused') }}</button>
        </div>
        <label class="lf__limit">
          <span>{{ t('adminLargest.show') }}</span>
          <select v-model.number="limit">
            <option :value="10">10</option>
            <option :value="25">25</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
          </select>
        </label>
      </div>
    </div>

    <div v-if="selected.length" class="lf__bulk">
      <span>{{ t('adminLargest.selected', { count: fmtNum(selected.length), size: fmtBytes(selectedBytes) }) }}</span>
      <div class="lf__bulk-actions">
        <button type="button" :disabled="working" @click="trash(selected)">{{ t('adminLargest.moveToTrash') }}</button>
        <button type="button" class="lf__link" @click="selected = []">{{ t('adminLargest.clear') }}</button>
      </div>
    </div>

    <div v-if="blocked.length" class="lf__blocked">
      <p>{{ t('adminLargest.blocked', { count: fmtNum(blocked.length) }) }}</p>
      <div class="lf__bulk-actions">
        <button type="button" :disabled="working" @click="trash(blocked, true)">{{ t('adminLargest.trashAnyway') }}</button>
        <button type="button" class="lf__link" @click="blocked = []">{{ t('adminLargest.cancel') }}</button>
      </div>
    </div>

    <p v-if="error" class="lf__notice">{{ t('adminLargest.error') }}</p>
    <p v-else-if="pending && !data" class="lf__notice">{{ t('adminLargest.loading') }}</p>

    <ul v-else-if="data" class="lf__rows">
      <li v-for="file in files" :key="file.key" class="lf__row" :class="{ 'is-selected': selected.includes(file.key) }">
        <label class="lf__check">
          <input type="checkbox" :checked="selected.includes(file.key)" @change="toggle(file.key)">
          <span class="lf__sr">{{ shortKey(file.key) }}</span>
        </label>

        <button type="button" class="lf__thumb" @click="viewing = file">
          <img :src="fileUrl(file.key)" alt="" loading="lazy">
        </button>

        <div class="lf__file">
          <button type="button" class="lf__name" @click="viewing = file">{{ shortKey(file.key) }}</button>
          <span class="lf__meta">{{ folderOf(file.key) }}</span>
          <span class="lf__meta">{{ fileType(file.contentType) }} · {{ formatDateTime(file.uploadedAt) }}</span>
        </div>

        <div class="lf__usage">
          <template v-if="file.referenced">
            <NuxtLink
              v-for="usage in [...file.albums, ...file.usages]"
              :key="usage.kind + usage.label + (usage.role ?? '')"
              :to="usage.href ? localePath(usage.href) : localePath('/admin')"
              class="lf__tag"
            >{{ usage.role || usage.kind }} · {{ usage.label }}</NuxtLink>
          </template>
          <span v-else class="lf__tag lf__tag--unused">{{ t('adminLargest.unused') }}</span>
        </div>

        <span class="lf__size">{{ fmtBytes(file.size) }}</span>

        <div class="lf__actions">
          <button type="button" @click="viewing = file">{{ t('adminLargest.view') }}</button>
          <button type="button" :disabled="working" @click="trash([file.key])">{{ t('adminLargest.trash') }}</button>
        </div>
      </li>
    </ul>

    <!-- Viewer -->
    <Teleport to="body">
      <div v-if="viewing" class="lfv" role="dialog" aria-modal="true">
        <div class="lfv__bar">
          <button type="button" class="lfv__btn" @click="viewing = null">{{ t('adminLargest.close') }}</button>
          <div class="lfv__id">
            <span class="lfv__key">{{ viewing.key }}</span>
            <span class="lfv__pos">{{ t('adminLargest.position', { index: fmtNum(viewIndex + 1), total: fmtNum(files.length) }) }}</span>
          </div>
          <button type="button" class="lfv__btn" :disabled="viewIndex <= 0" :aria-label="t('adminLargest.previous')" @click="step(-1)">←</button>
          <button type="button" class="lfv__btn" :disabled="viewIndex >= files.length - 1" :aria-label="t('adminLargest.next')" @click="step(1)">→</button>
        </div>
        <div class="lfv__body">
          <div class="lfv__stage">
            <img :src="fileUrl(viewing.key)" :alt="shortKey(viewing.key)">
          </div>
          <aside class="lfv__side">
            <h2>{{ t('adminLargest.details') }}</h2>
            <dl class="lfv__dl">
              <div><dt>{{ t('adminLargest.size') }}</dt><dd>{{ fmtBytes(viewing.size) }}</dd></div>
              <div><dt>{{ t('adminLargest.format') }}</dt><dd>{{ viewing.contentType || '—' }}</dd></div>
              <div><dt>{{ t('adminLargest.uploaded') }}</dt><dd>{{ formatDateTime(viewing.uploadedAt) }}</dd></div>
              <div><dt>{{ t('adminLargest.folder') }}</dt><dd>{{ folderOf(viewing.key) }}</dd></div>
            </dl>

            <h2>{{ t('adminLargest.usedBy') }}</h2>
            <template v-if="viewing.referenced">
              <NuxtLink
                v-for="usage in [...viewing.albums, ...viewing.usages]"
                :key="usage.kind + usage.label + (usage.role ?? '')"
                :to="usage.href ? localePath(usage.href) : localePath('/admin')"
                class="lfv__usage"
              >{{ usage.role || usage.kind }} · {{ usage.label }}</NuxtLink>
              <p class="lfv__hint">{{ t('adminLargest.referencedHint') }}</p>
            </template>
            <p v-else class="lfv__hint">{{ t('adminLargest.unusedHint') }}</p>

            <div class="lfv__actions">
              <button type="button" class="lfv__download" :disabled="!!downloading" @click="downloadOriginal(viewing)">
                {{ downloading === viewing.key ? t('adminLargest.preparing') : t('adminLargest.download') }}
              </button>
              <button
                v-if="viewing.contentType === 'image/webp'"
                type="button"
                class="lfv__download"
                :disabled="!!downloading"
                @click="downloadAsJpeg(viewing)"
              >{{ t('adminLargest.downloadJpeg') }}</button>
              <button type="button" class="lfv__trash" :disabled="working" @click="trash([viewing.key])">{{ t('adminLargest.moveToTrash') }}</button>
            </div>
          </aside>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.lf { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.lf__head { display: flex; align-items: flex-end; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 2rem; }
.lf__back { display: inline-block; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.lf__back:hover { color: var(--accent); }
.lf__title { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; margin-top: 0.5rem; }
.lf__lead { font-size: 0.78rem; line-height: 1.7; color: var(--muted); margin-top: 0.35rem; max-width: 62ch; }
.lf__refresh { border: 1px solid var(--subtle); background: none; color: var(--dark); cursor: pointer; font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; padding: 0.55rem 1.1rem; }
.lf__refresh:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.lf__refresh:disabled { opacity: 0.5; cursor: default; }

.lf__notice { color: var(--muted); font-size: 0.78rem; padding: 0.75rem 0; }

.lf__bar { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border-bottom: 1px solid var(--subtle); padding-bottom: 0.9rem; margin-bottom: 0.5rem; }
.lf__stat { font-size: 0.72rem; color: var(--muted); }
.lf__controls { display: flex; align-items: center; gap: 1rem; }
.lf__tabs { display: flex; border: 1px solid var(--subtle); }
.lf__tabs button { border: 0; background: none; color: var(--muted); padding: 0.45rem 0.8rem; font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.lf__tabs button.is-active { background: var(--dark); color: var(--body-bg); }
.lf__limit { display: flex; align-items: center; gap: 0.5rem; font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.lf__limit select { border: 1px solid var(--subtle); background: none; color: var(--dark); padding: 0.35rem 0.5rem; font-size: 0.72rem; }

.lf__bulk, .lf__blocked { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border: 1px solid var(--accent); background: color-mix(in srgb, var(--accent) 6%, transparent); padding: 0.7rem 0.9rem; margin: 0.9rem 0; font-size: 0.74rem; }
.lf__bulk-actions { display: flex; align-items: center; gap: 0.6rem; }
.lf__bulk-actions button { border: 1px solid var(--dark); background: var(--dark); color: var(--body-bg); padding: 0.5rem 0.9rem; font-size: 0.52rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.lf__bulk-actions button:disabled { opacity: 0.5; cursor: default; }
.lf__link { border: 0 !important; background: none !important; color: var(--muted) !important; }

.lf__rows { list-style: none; }
.lf__row { display: grid; grid-template-columns: 1.6rem 4.6rem minmax(0, 1fr) 15rem 5.5rem 9rem; gap: 1rem; align-items: center; padding: 0.8rem 0.25rem; border-bottom: 1px solid var(--subtle); }
.lf__row.is-selected { background: color-mix(in srgb, var(--accent) 5%, transparent); }
.lf__check { display: flex; align-items: center; justify-content: center; cursor: pointer; }
.lf__check input { width: 0.95rem; height: 0.95rem; accent-color: var(--accent); cursor: pointer; }
.lf__sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.lf__thumb { width: 4.6rem; height: 3.3rem; border: 1px solid var(--subtle); background: var(--paper); padding: 0; cursor: pointer; overflow: hidden; }
.lf__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.lf__file { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
.lf__name { border: 0; background: none; padding: 0; text-align: left; font-family: ui-monospace, monospace; font-size: 0.74rem; color: var(--dark); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lf__name:hover { color: var(--accent); }
.lf__meta { font-size: 0.62rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lf__usage { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.lf__tag { display: inline-block; border: 1px solid var(--subtle); color: var(--muted); padding: 0.22rem 0.45rem; font-size: 0.56rem; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lf__tag:hover { border-color: var(--accent); color: var(--accent); }
.lf__tag--unused { border-color: var(--accent); color: var(--accent); }
.lf__size { text-align: right; font-size: 0.78rem; font-variant-numeric: tabular-nums; }
.lf__actions { display: flex; gap: 0.35rem; justify-content: flex-end; }
.lf__actions button { border: 1px solid var(--subtle); background: none; color: var(--dark); padding: 0.4rem 0.6rem; font-size: 0.52rem; letter-spacing: 0.12em; text-transform: uppercase; cursor: pointer; }
.lf__actions button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.lf__actions button:disabled { opacity: 0.5; cursor: default; }

/* Viewer */
.lfv { position: fixed; inset: 0; z-index: 90; background: var(--dark); display: flex; flex-direction: column; }
.lfv__bar { display: flex; align-items: center; gap: 1rem; padding: 0.9rem 1.2rem; border-bottom: 1px solid color-mix(in srgb, var(--body-bg) 18%, transparent); }
.lfv__btn { border: 1px solid color-mix(in srgb, var(--body-bg) 30%, transparent); background: none; color: var(--body-bg); padding: 0.45rem 0.8rem; font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.lfv__btn:disabled { opacity: 0.35; cursor: default; }
.lfv__id { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; flex-grow: 1; }
.lfv__key { font-family: ui-monospace, monospace; font-size: 0.7rem; color: var(--body-bg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lfv__pos { font-size: 0.62rem; color: color-mix(in srgb, var(--body-bg) 60%, transparent); }
.lfv__body { flex-grow: 1; display: flex; min-height: 0; }
.lfv__stage { flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 1.5rem; min-width: 0; }
.lfv__stage img { max-width: 100%; max-height: 100%; object-fit: contain; }
.lfv__side { width: 22rem; flex-shrink: 0; border-left: 1px solid color-mix(in srgb, var(--body-bg) 18%, transparent); padding: 1.6rem 1.4rem; display: flex; flex-direction: column; gap: 0.9rem; overflow-y: auto; }
.lfv__side h2 { font-family: var(--font-serif); font-size: 1.15rem; font-weight: 300; color: var(--body-bg); }
.lfv__dl > div { display: flex; justify-content: space-between; gap: 0.8rem; padding: 0.3rem 0; }
.lfv__dl dt { font-size: 0.52rem; letter-spacing: 0.16em; text-transform: uppercase; color: color-mix(in srgb, var(--body-bg) 60%, transparent); }
.lfv__dl dd { font-size: 0.76rem; color: var(--body-bg); font-variant-numeric: tabular-nums; text-align: right; word-break: break-word; }
.lfv__usage { display: block; color: var(--body-bg); font-size: 0.74rem; text-decoration: none; border-bottom: 1px solid color-mix(in srgb, var(--body-bg) 25%, transparent); padding-bottom: 0.4rem; }
.lfv__usage:hover { color: var(--accent); }
.lfv__hint { font-size: 0.68rem; line-height: 1.6; color: color-mix(in srgb, var(--body-bg) 62%, transparent); }
.lfv__actions { margin-top: auto; display: flex; flex-direction: column; gap: 0.5rem; }
.lfv__download { text-align: center; border: 1px solid color-mix(in srgb, var(--body-bg) 30%, transparent); background: none; color: var(--body-bg); padding: 0.75rem 1rem; font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; text-decoration: none; cursor: pointer; }
.lfv__download:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); }
.lfv__download:disabled { opacity: 0.5; cursor: default; }
.lfv__trash { border: 1px solid var(--accent); background: none; color: var(--accent); padding: 0.75rem 1rem; font-size: 0.56rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.lfv__trash:disabled { opacity: 0.5; cursor: default; }

@media (max-width: 900px) {
  .lf__row { grid-template-columns: 1.6rem 4.6rem minmax(0, 1fr) 5rem; grid-template-areas: none; }
  .lf__usage, .lf__actions { grid-column: 3 / -1; }
  .lfv__body { flex-direction: column; }
  .lfv__side { width: auto; border-left: 0; border-top: 1px solid color-mix(in srgb, var(--body-bg) 18%, transparent); }
}
@media (max-width: 720px) {
  .lf { padding: 2rem 1rem 4rem; }
}
</style>
