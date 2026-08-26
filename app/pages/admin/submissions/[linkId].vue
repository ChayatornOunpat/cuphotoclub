<script setup lang="ts">
// One collection's pool — everything participants sent through that link, and
// the album those photos end up in.
//
// The model is per-photo review, not batch consolidation. Every submission
// carries a decision (pending / approved / rejected); approving copies that one
// photo into the collection's album and appends a row. Two consequences worth
// knowing:
//
//   • Approving is one photo per request, so the old "select 15, consolidate,
//     repeat" ceiling is gone. Requests are SERIALISED (see `enqueue`) because
//     the album's rows are a single JSON array read-modify-written on each
//     write — a burst from a held-down key would drop rows.
//   • "Approved" and "currently in the album" are separate facts. An editor
//     removing an image on the canvas does not un-decide it, so the pool shows
//     the divergence and offers to re-add rather than quietly disagreeing.
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()

const linkId = computed(() => String(route.params.linkId || ''))

type Review = 'pending' | 'approved' | 'rejected'

interface PoolItem {
  id: string
  caption: string | null
  size: number
  review: Review
  inAlbum: boolean
  publishedTo: string | null
  createdAt: string
  contributorId: string
  displayName: string | null
  contact: string | null
  creditHandle: boolean | null
  note: string | null
  previewUrl: string
  downloadUrl: string
}
interface PoolAlbum {
  id: string
  slug: string
  title: string
  visibility: string
  coverSrc: string
  photoCount: number
}
interface Pool {
  total: number
  page: number
  perPage: number
  pageCount: number
  counts: { pending: number, approved: number, rejected: number, all: number }
  album: PoolAlbum | null
  missingFromAlbum: number
  items: PoolItem[]
}
interface LinkOption { id: string, label: string | null, description: string | null }

useHead(() => ({ title: t('adminPool.title') }))

// 'pending' by default: the working set is what is left to look at, so the pool
// reads as something that empties.
const reviewFilter = computed<'all' | Review>(() => {
  const value = String(route.query.review || 'pending')
  return (['all', 'pending', 'approved', 'rejected'] as const).includes(value as 'all' | Review)
    ? value as 'all' | Review
    : 'pending'
})
const page = computed(() => Number(route.query.page) || 1)

const { data: links } = await useFetch<LinkOption[]>('/api/admin/upload-links')
const link = computed(() => links.value?.find(entry => entry.id === linkId.value) ?? null)

const query = computed(() => ({ linkId: linkId.value, review: reviewFilter.value, page: page.value }))
const { data: pool, refresh } = await useFetch<Pool>('/api/admin/submissions', { query })

function setQuery(patch: Record<string, string | number | undefined>) {
  router.push({ query: { ...route.query, page: undefined, ...patch } })
}

const { data: albums } = await useFetch('/api/admin/albums/picker')

const busy = ref(false)
const error = ref('')
const notice = ref('')
function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}

const album = computed(() => pool.value?.album ?? null)
const counts = computed(() => pool.value?.counts ?? { pending: 0, approved: 0, rejected: 0, all: 0 })
const missing = computed(() => pool.value?.missingFromAlbum ?? 0)

// ── Contributor notes ────────────────────────────────────────────────────────
// The note lives once on the contributor, but the pool query denormalises it
// onto every one of their photos (see server/api/admin/submissions/index.get.ts)
// so it can travel with a review decision. Regrouping by contributorId here is
// what turns that back into "one note, N photos" instead of the same text
// repeated per tile. Scoped to whatever's currently loaded — same page and
// filter the grid itself is showing, not the whole collection.
interface ContributorNote {
  contributorId: string
  displayName: string | null
  note: string
  photos: PoolItem[]
}
const contributorNotes = computed<ContributorNote[]>(() => {
  const byContributor = new Map<string, ContributorNote>()
  for (const item of pool.value?.items ?? []) {
    const note = item.note?.trim()
    if (!note) continue
    const existing = byContributor.get(item.contributorId)
    if (existing) existing.photos.push(item)
    else byContributor.set(item.contributorId, { contributorId: item.contributorId, displayName: item.displayName, note, photos: [item] })
  }
  return [...byContributor.values()]
})
const notesCollapsed = ref(false)

// Clicking a note's thumbnail spotlights the matching tile in the grid rather
// than filtering it out — the point is "here's the photo this refers to",
// and a filter would hide the context of what else that contributor sent.
const highlightedItemId = ref('')
function highlightPhoto(id: string) {
  highlightedItemId.value = highlightedItemId.value === id ? '' : id
  if (!highlightedItemId.value) return
  nextTick(() => {
    document.getElementById(`pool-tile-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

// ── Which album this collection feeds ───────────────────────────────────────
// Switching is allowed with photos already approved. Their copies stay in the
// old album's folder — the server repoints their keys at the new album, the
// pool then reports them as missing from it, and "Re-add to album" copies them
// across. Clearing the old folder and the old album is a manual job.
const changingAlbum = ref(false)
async function changeAlbum(value: string) {
  if (changingAlbum.value) return
  changingAlbum.value = true
  error.value = ''
  try {
    await $fetch<{ id: string }>(`/api/admin/upload-links/${linkId.value}`, {
      method: 'PATCH',
      body: { albumId: value || null }
    })
    notice.value = value ? t('adminPool.albumChanged') : t('adminPool.albumUnlinked')
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminPool.albumChangeFailed'))
  } finally {
    changingAlbum.value = false
  }
}

// ── Selection ───────────────────────────────────────────────────────────────
const selected = ref(new Set<string>())
function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function clearSelection() { selected.value = new Set() }
function selectAllOnPage() {
  selected.value = new Set(pool.value?.items.map(item => item.id) ?? [])
}

// ── Serialised decisions ────────────────────────────────────────────────────
// Every approval rewrites the album's rows array. Overlapping requests read the
// same array and the later write wins, dropping the earlier row — which a
// keyboard-fast reviewer would hit constantly. One in flight at a time.
let chain: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<unknown>): Promise<void> {
  const run = chain.then(task, task).then(() => {}, (e: unknown) => {
    error.value = errMsg(e, t('adminPool.reviewFailed'))
  })
  chain = run
  return run
}

// The server accepts a small batch; the keyboard path sends one at a time.
const REVIEW_BATCH = 12

async function decide(ids: string[], decision: Review) {
  if (!ids.length) return
  error.value = ''
  for (let i = 0; i < ids.length; i += REVIEW_BATCH) {
    const slice = ids.slice(i, i + REVIEW_BATCH)
    // Response type pinned: leaving it to inference makes Nuxt's typed-route
    // generics recurse until tsc gives up ("excessive stack depth").
    await enqueue(() => $fetch<{ ok: boolean }>('/api/admin/submissions/review', {
      method: 'POST',
      body: { ids: slice, decision }
    }))
  }
  await refresh()
}

async function decideSelected(decision: Review) {
  const ids = [...selected.value]
  if (!ids.length || busy.value) return
  busy.value = true
  clearSelection()
  try {
    await decide(ids, decision)
    notice.value = decision === 'approved'
      ? t('adminPool.approvedN', { n: ids.length })
      : decision === 'rejected'
        ? t('adminPool.rejectedN', { n: ids.length })
        : t('adminPool.returnedN', { n: ids.length })
  } finally {
    busy.value = false
  }
}

// ── Repair: the album is missing photos that are approved ──────────────────
const repairing = ref(false)
async function repair() {
  if (repairing.value) return
  repairing.value = true
  error.value = ''
  try {
    // Bounded per call, so keep going until the server says nothing is left.
    for (let guard = 0; guard < 40; guard++) {
      const res = await $fetch<{ restored: number, remaining: number }>(
        '/api/admin/submissions/repair',
        { method: 'POST', body: { linkId: linkId.value } }
      )
      if (!res.remaining) break
    }
    notice.value = t('adminPool.repaired')
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminPool.repairFailed'))
  } finally {
    repairing.value = false
  }
}

// ── Batch download ──────────────────────────────────────────────────────────
// Sequential on purpose. Each download streams a full-size original through the
// Worker, so firing forty at once is forty concurrent buffered responses; one
// at a time keeps that flat and gives an honest progress count.
//
// WebP is converted to JPEG in the browser: the uploader's compressor emits
// WebP, and the places these photos end up (Instagram, print shops, older
// tools) still want JPEG. Doing it on a canvas costs nothing — no Worker
// memory, and none of the Cloudflare image-transform quota, which is reserved
// for bounded public surfaces.
const downloading = ref(0)
const downloadTotal = ref(0)

async function toJpeg(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return blob
    // JPEG has no alpha; without a white ground a transparent PNG/WebP would
    // come out with black edges.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0)
    const out = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92)
    )
    return out ?? blob
  } finally {
    bitmap.close()
  }
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking immediately can cancel the save in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

function fileNameFor(item: PoolItem, ext: string) {
  const who = (item.displayName || t('adminPool.anonymous')).replace(/[^\w-]+/g, '-').slice(0, 40)
  return `${who}-${item.id.slice(0, 8)}.${ext}`
}

async function downloadSelected() {
  const ids = [...selected.value]
  if (!ids.length || downloading.value) return
  const items = (pool.value?.items ?? []).filter(item => ids.includes(item.id))
  error.value = ''
  downloadTotal.value = items.length
  downloading.value = 0

  try {
    for (const item of items) {
      // ?confirm=1 is what marks it used — same contract as the single-file link.
      const res = await fetch(item.downloadUrl)
      if (!res.ok) throw new Error(String(res.status))
      let blob = await res.blob()
      let ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
      if (blob.type === 'image/webp') {
        blob = await toJpeg(blob)
        ext = 'jpg'
      }
      saveBlob(blob, fileNameFor(item, ext))
      downloading.value++
    }
    notice.value = t('adminPool.downloadedN', { n: items.length })
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminPool.downloadFailed'))
  } finally {
    downloading.value = 0
    downloadTotal.value = 0
  }
}

// ── Delete (removes the submission itself, not just its decision) ───────────
const confirmDelete = ref(false)
async function deleteSelected() {
  if (!selected.value.size || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ removed: number, trashed: number }>('/api/admin/submissions', {
      method: 'DELETE',
      body: { ids: [...selected.value] }
    })
    notice.value = t('adminPool.deleted', { removed: result.removed, trashed: result.trashed })
    clearSelection()
    confirmDelete.value = false
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminPool.deleteFailed'))
  } finally {
    busy.value = false
  }
}

// ── Focused review ──────────────────────────────────────────────────────────
// Walks the loaded pending items. Each decision drops one locally so the next
// photo appears instantly; when the local queue runs dry the refreshed page
// supplies the next batch.
const reviewing = ref(false)
const queue = ref<PoolItem[]>([])
const current = computed(() => queue.value[0] ?? null)

function fillQueue() {
  queue.value = (pool.value?.items ?? []).filter(item => item.review === 'pending')
}

async function startReview() {
  if (reviewFilter.value !== 'pending') {
    await router.push({ query: { ...route.query, review: 'pending', page: undefined } })
    await refresh()
  }
  fillQueue()
  reviewing.value = true
}
function stopReview() {
  reviewing.value = false
  queue.value = []
}
async function reviewDecide(decision: Review) {
  const item = current.value
  if (!item) return
  queue.value = queue.value.slice(1)
  await decide([item.id], decision)
  if (!queue.value.length) fillQueue()
}
// Skip defers rather than decides — it moves the photo to the back so an
// uncertain call never stalls the pass.
function skip() {
  if (queue.value.length < 2) return
  queue.value = [...queue.value.slice(1), queue.value[0]!]
}

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  const key = e.key.toLowerCase()

  if (previewItem.value) {
    if (key === 'escape') { e.preventDefault(); previewItem.value = null }
    else if (key === 'arrowleft') { e.preventDefault(); previewStep(-1) }
    else if (key === 'arrowright') { e.preventDefault(); previewStep(1) }
    return
  }

  if (!reviewing.value) return
  if (key === 'a') { e.preventDefault(); reviewDecide('approved') }
  else if (key === 'r') { e.preventDefault(); reviewDecide('rejected') }
  else if (key === 's') { e.preventDefault(); skip() }
  else if (key === 'escape') { e.preventDefault(); stopReview() }
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))

// How this person will be credited if the photo is published — shown before the
// decision, because it is the decision's consequence. Mirrors creditFor() on
// the server: a name is consent; a handle needs the switch.
function creditLine(item: PoolItem) {
  if (item.displayName?.trim()) return t('adminPool.creditName', { name: item.displayName.trim() })
  if (item.creditHandle && item.contact?.trim()) return t('adminPool.creditHandle', { handle: item.contact.trim() })
  return t('adminPool.creditAnon')
}

function stateOf(item: PoolItem) {
  if (item.review === 'approved') return item.inAlbum ? 'approved' : 'gone'
  return item.review
}

function kb(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`
}

// ── Fullscreen preview ───────────────────────────────────────────────────────
// Separate from Focused Review: no decision attached, just "let me look at
// this one bigger" from anywhere in the grid, so it steps through whatever
// list the grid is currently showing rather than only the pending queue.
const previewItem = ref<PoolItem | null>(null)
const previewIndex = computed(() => {
  if (!previewItem.value) return -1
  return (pool.value?.items ?? []).findIndex(entry => entry.id === previewItem.value?.id)
})
function previewStep(delta: number) {
  const items = pool.value?.items ?? []
  const next = previewIndex.value + delta
  if (next < 0 || next >= items.length) return
  previewItem.value = items[next]!
}

const FILTERS = ['pending', 'approved', 'rejected', 'all'] as const
</script>

<template>
  <div class="pool">
    <header class="pool__head">
      <NuxtLink class="pool__back" :to="localePath('/admin/submissions')">
        ← {{ t('adminPool.allCollections') }}
      </NuxtLink>
      <h1 class="pool__title">{{ link?.label || t('adminUploadLinks.untitled') }}</h1>
      <p v-if="link?.description" class="pool__desc">{{ link.description }}</p>
      <p class="pool__sub">{{ t('adminPool.sub') }}</p>
    </header>

    <!-- Where approved photos go, stated above the photos rather than implied. -->
    <section class="dest">
      <div v-if="album" class="dest__shot">
        <img v-if="album.coverSrc" :src="album.coverSrc" alt="" loading="lazy">
        <span v-else class="dest__shot--empty">{{ t('adminPool.noCover') }}</span>
      </div>
      <div class="dest__body">
        <p class="dest__label">{{ t('adminPool.destLabel') }}</p>
        <p v-if="album" class="dest__name">
          <span>{{ album.title || t('adminUploadLinks.untitled') }}</span>
          <span class="dest__pill" :class="album.visibility === 'draft' ? 'dest__pill--draft' : 'dest__pill--live'">
            {{ album.visibility === 'draft' ? t('adminPool.draft') : t('adminPool.published') }}
          </span>
        </p>
        <p v-else class="dest__none">{{ t('adminPool.noAlbumYet') }}</p>
        <p v-if="album" class="dest__sub">
          {{ t('adminPool.inAlbumCount', { n: album.photoCount }) }}
          <span v-if="album.visibility === 'draft'"> · {{ t('adminPool.notPublicYet') }}</span>
        </p>
      </div>
      <div class="dest__acts">
        <label class="dest__pick">
          <span class="dest__pick-label">{{ t('adminPool.changeAlbum') }}</span>
          <select
            class="dest__select"
            :value="album?.id ?? ''"
            :disabled="changingAlbum"
            @change="changeAlbum(($event.target as HTMLSelectElement).value)"
          >
            <option value="">{{ t('adminPool.unlinked') }}</option>
            <option v-for="entry in albums ?? []" :key="entry.id" :value="entry.id">
              {{ entry.title || entry.slug }}{{ entry.visibility === 'draft' ? ` · ${t('adminPool.draft')}` : '' }}
            </option>
          </select>
        </label>
        <NuxtLink v-if="album" class="btn" :to="localePath(`/admin/albums/${album.slug}`)">
          {{ t('adminPool.openAlbum') }}
        </NuxtLink>
      </div>
    </section>

    <!-- The two facts disagreeing: approved, but no longer on the canvas. -->
    <div v-if="missing" class="diverge">
      <span>{{ t('adminPool.missingFromAlbum', { n: missing }) }}</span>
      <button type="button" class="btn" :disabled="repairing" @click="repair">
        {{ repairing ? t('adminPool.working') : t('adminPool.reAdd') }}
      </button>
    </div>

    <p v-if="error" class="pool__error">{{ error }}</p>
    <p v-if="notice" class="pool__notice">{{ notice }}</p>

    <!-- ── Focused review ─────────────────────────────────────────────── -->
    <section v-if="reviewing" class="rev">
      <div class="rev__stage">
        <template v-if="current">
          <p class="rev__seq">{{ t('adminPool.reviewLeft', { n: counts.pending }) }}</p>
          <img class="rev__img" :src="current.previewUrl" alt="">
        </template>
        <p v-else class="rev__done">{{ t('adminPool.reviewDone') }}</p>
      </div>
      <aside class="rev__rail">
        <div class="rev__body">
          <template v-if="current">
            <div>
              <p class="rev__label">{{ t('adminPool.sentBy') }}</p>
              <p class="rev__who" :class="{ 'rev__who--anon': !current.displayName }">
                {{ current.displayName || t('adminPool.anonymous') }}
              </p>
              <p class="rev__credit">{{ creditLine(current) }}</p>
            </div>
            <p v-if="current.caption" class="rev__caption">{{ current.caption }}</p>
            <p v-if="current.note" class="rev__note">{{ current.note }}</p>
            <p class="rev__meta">{{ kb(current.size) }}</p>
          </template>
        </div>
        <div class="rev__acts">
          <button type="button" class="btn btn--approve" :disabled="!current" @click="reviewDecide('approved')">
            {{ t('adminPool.approve') }} <span class="rev__key">A</span>
          </button>
          <button type="button" class="btn btn--reject" :disabled="!current" @click="reviewDecide('rejected')">
            {{ t('adminPool.reject') }} <span class="rev__key">R</span>
          </button>
          <button type="button" class="btn" :disabled="queue.length < 2" @click="skip">
            {{ t('adminPool.skip') }} <span class="rev__key">S</span>
          </button>
          <button type="button" class="btn" @click="stopReview">{{ t('adminPool.backToGrid') }}</button>
        </div>
      </aside>
    </section>

    <div v-else class="split" :class="{ 'is-collapsed': notesCollapsed }">
    <div class="split__photos">
      <!-- Filter tabs double as the collection's tallies. -->
      <div class="tabs">
        <button
          v-for="key in FILTERS"
          :key="key"
          type="button"
          class="tabs__t"
          :class="{ 'is-on': reviewFilter === key }"
          @click="setQuery({ review: key })"
        >
          {{ t(`adminPool.filter_${key}`) }}<span class="tabs__n">{{ counts[key] }}</span>
        </button>
        <span class="tabs__spacer" />
        <button
          v-if="counts.pending"
          type="button"
          class="btn btn--primary"
          @click="startReview"
        >{{ t('adminPool.startReview') }}</button>
      </div>

      <div v-if="selected.size" class="bar">
        <span class="bar__count">{{ t('adminPool.selected', { n: selected.size }) }}</span>
        <button type="button" class="btn" @click="clearSelection">{{ t('adminPool.clear') }}</button>
        <button type="button" class="btn btn--approve" :disabled="busy" @click="decideSelected('approved')">
          {{ t('adminPool.approve') }}
        </button>
        <button type="button" class="btn btn--reject" :disabled="busy" @click="decideSelected('rejected')">
          {{ t('adminPool.reject') }}
        </button>
        <button type="button" class="btn" :disabled="busy" @click="decideSelected('pending')">
          {{ t('adminPool.unreview') }}
        </button>
        <button type="button" class="btn" :disabled="busy || downloadTotal > 0" @click="downloadSelected">
          {{ downloadTotal
            ? t('adminPool.downloading', { done: downloading, total: downloadTotal })
            : t('adminPool.downloadSelected') }}
        </button>
        <button v-if="!confirmDelete" type="button" class="btn btn--danger" @click="confirmDelete = true">
          {{ t('adminPool.delete') }}
        </button>
        <template v-else>
          <button type="button" class="btn btn--danger" :disabled="busy" @click="deleteSelected">
            {{ t('adminPool.confirmDelete') }}
          </button>
          <button type="button" class="btn" @click="confirmDelete = false">{{ t('adminPool.cancel') }}</button>
        </template>
      </div>

      <div v-if="pool?.items.length" class="pool__toolbar">
        <button type="button" class="btn" @click="selectAllOnPage">{{ t('adminPool.selectPage') }}</button>
      </div>

      <ul v-if="pool?.items.length" class="grid">
        <li
          v-for="item in pool.items"
          :id="`pool-tile-${item.id}`"
          :key="item.id"
          class="tile"
          :class="[`is-${stateOf(item)}`, { 'is-selected': selected.has(item.id), 'is-highlighted': highlightedItemId === item.id }]"
        >
          <button
            type="button"
            class="tile__pick"
            :aria-pressed="selected.has(item.id)"
            :aria-label="item.displayName || t('adminPool.anonymous')"
            @click="toggle(item.id)"
          >
            <img class="tile__img" :src="item.previewUrl" alt="" loading="lazy">
            <span v-if="selected.has(item.id)" class="tile__check">✓</span>
            <span v-if="stateOf(item) !== 'pending'" class="tile__flag">
              {{ t(`adminPool.state_${stateOf(item)}`) }}
            </span>
          </button>
          <button
            type="button"
            class="tile__preview"
            :aria-label="t('adminPool.previewPhoto')"
            @click="previewItem = item"
          >
            <Icon name="heroicons:arrows-pointing-out" />
          </button>
          <div class="tile__foot">
            <span class="tile__by">{{ item.displayName || t('adminPool.anonymous') }}</span>
            <span class="tile__meta">{{ kb(item.size) }}</span>
            <p v-if="item.caption" class="tile__caption">{{ item.caption }}</p>
            <a class="btn tile__dl" :href="item.downloadUrl">{{ t('adminPool.download') }}</a>
          </div>
        </li>
      </ul>

      <p v-else class="pool__empty">{{ t('adminPool.emptyFilter') }}</p>

      <nav v-if="(pool?.pageCount ?? 1) > 1" class="pager">
        <button type="button" class="btn" :disabled="page <= 1" @click="setQuery({ page: page - 1 })">
          {{ t('adminPool.prev') }}
        </button>
        <span class="pager__at">{{ t('adminPool.pageOf', { page, total: pool?.pageCount ?? 1 }) }}</span>
        <button
          type="button"
          class="btn"
          :disabled="page >= (pool?.pageCount ?? 1)"
          @click="setQuery({ page: page + 1 })"
        >{{ t('adminPool.next') }}</button>
      </nav>
    </div>

    <div v-if="contributorNotes.length" class="split__notes">
      <div class="split__notes-body">
        <div class="split__notes-head">
          <p class="split__notes-count"><b>{{ contributorNotes.length }}</b> {{ t('adminPool.notesHead') }}</p>
          <button type="button" class="split__collapse" @click="notesCollapsed = true">
            {{ t('adminPool.notesCollapse') }}
            <span class="split__collapse-icon" aria-hidden="true" />
          </button>
        </div>
        <div class="cardlist">
          <div v-for="entry in contributorNotes" :key="entry.contributorId" class="ncard">
            <div class="ncard__body">
              <div class="ncard__head">
                <span class="ncard__name" :class="{ 'ncard__name--anon': !entry.displayName }">
                  {{ entry.displayName || t('adminPool.anonymous') }}
                </span>
                <span class="ncard__count">{{ t('adminPool.notePhotoCount', { n: entry.photos.length }) }}</span>
              </div>
              <p class="ncard__note">{{ entry.note }}</p>
              <div class="ncard__photos">
                <button
                  v-for="photo in entry.photos.slice(0, 4)"
                  :key="photo.id"
                  type="button"
                  class="ncard__thumb"
                  :class="{ 'is-active': highlightedItemId === photo.id }"
                  :aria-label="t('adminPool.highlightPhoto')"
                  @click="highlightPhoto(photo.id)"
                >
                  <img :src="photo.previewUrl" alt="" loading="lazy">
                </button>
                <span v-if="entry.photos.length > 4" class="ncard__thumb-more">+{{ entry.photos.length - 4 }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="split__collapsed-rail"
        :aria-label="t('adminPool.notesExpand')"
        @click="notesCollapsed = false"
      >
        <span class="split__collapsed-count">{{ contributorNotes.length }}</span>
        <span class="split__collapsed-label">{{ t('adminPool.notesLabel') }}</span>
      </button>
    </div>
    </div>

    <div v-if="previewItem" class="preview" @click.self="previewItem = null">
      <img class="preview__img" :src="previewItem.previewUrl" alt="">
      <div class="preview__meta">
        <span class="preview__who">{{ previewItem.displayName || t('adminPool.anonymous') }}</span>
        <span class="preview__size">{{ kb(previewItem.size) }}</span>
      </div>
      <button type="button" class="preview__close" :aria-label="t('adminPool.closePreview')" @click="previewItem = null">
        <Icon name="heroicons:x-mark" />
      </button>
      <button
        v-if="previewIndex > 0"
        type="button"
        class="preview__nav preview__nav--prev"
        :aria-label="t('adminPool.prevPhoto')"
        @click="previewStep(-1)"
      >
        <Icon name="heroicons:chevron-left" />
      </button>
      <button
        v-if="pool && previewIndex < pool.items.length - 1"
        type="button"
        class="preview__nav preview__nav--next"
        :aria-label="t('adminPool.nextPhoto')"
        @click="previewStep(1)"
      >
        <Icon name="heroicons:chevron-right" />
      </button>
    </div>

    <p class="pool__foot">{{ t('adminPool.nothingPublic') }}</p>
  </div>
</template>

<style scoped>
.pool {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.pool__head { display: flex; flex-direction: column; gap: 0.3rem; }
.pool__back {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  width: fit-content;
}
.pool__back:hover { color: var(--accent); }
.pool__title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  color: var(--dark);
}
.pool__sub { font-family: var(--font-sans); font-size: 0.72rem; color: var(--muted); max-width: 62ch; }
.pool__desc { font-family: var(--font-sans); font-size: 0.8rem; color: var(--dark); max-width: 62ch; margin: 0; }
.pool__foot { font-family: var(--font-sans); font-size: 0.7rem; color: var(--muted); max-width: 62ch; }

.pool__error,
.pool__notice {
  border-left: 2px solid var(--accent);
  padding: 0.5rem 0.7rem;
  background: var(--paper);
  font-family: var(--font-sans);
  font-size: 0.74rem;
  color: var(--dark);
}
.pool__notice { border-left-color: var(--muted); }
.pool__empty { font-family: var(--font-sans); font-size: 0.74rem; color: var(--muted); }

/* ── Destination album ──────────────────────────────────────────────────── */
.dest {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 0.9rem;
  align-items: center;
  border: 1px solid var(--subtle);
  border-left: 2px solid var(--dark);
  background: #fff;
  padding: 0.75rem 0.9rem;
}
.dest__shot img,
.dest__shot--empty {
  width: 72px;
  height: 54px;
  object-fit: cover;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--subtle);
}
.dest__shot--empty {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.dest__label {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.dest__name {
  font-family: var(--font-serif);
  font-size: 1.02rem;
  color: var(--dark);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 0.1rem;
}
.dest__none { font-family: var(--font-sans); font-size: 0.8rem; color: var(--muted); font-style: italic; margin-top: 0.1rem; }
.dest__sub { font-family: var(--font-sans); font-size: 0.66rem; color: var(--muted); margin-top: 0.12rem; }
.dest__pill {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  border: 1px solid currentColor;
  padding: 0.16rem 0.36rem;
}
.dest__pill--draft { color: var(--muted); }
.dest__pill--live { color: var(--accent); }

.dest__acts { display: flex; align-items: end; gap: 0.6rem; flex-wrap: wrap; }
.dest__pick { display: flex; flex-direction: column; gap: 0.2rem; }
.dest__pick-label {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.dest__select {
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.32rem 0.45rem;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--dark);
  max-width: 15rem;
}
.dest__select:focus { outline: none; border-color: var(--accent); }

.diverge {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  flex-wrap: wrap;
  border-left: 2px solid #9A6B1F;
  background: var(--paper);
  padding: 0.55rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.74rem;
  color: var(--dark);
}

/* ── Filter tabs ────────────────────────────────────────────────────────── */
.tabs { display: flex; align-items: center; gap: 0.15rem; flex-wrap: wrap; }
.tabs__t {
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  background: none;
  border: 1px solid transparent;
  padding: 0.4rem 0.65rem;
  cursor: pointer;
}
.tabs__t:hover { color: var(--dark); }
.tabs__t.is-on { border-color: var(--subtle); background: #fff; color: var(--dark); }
.tabs__n { font-variant-numeric: tabular-nums; opacity: 0.6; margin-left: 0.35rem; }
.tabs__spacer { flex: 1; }

.bar {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-wrap: wrap;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--dark);
  background: var(--paper);
}
.bar__count {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
}

.pool__toolbar { display: flex; gap: 0.4rem; }

/* ── Focused review ─────────────────────────────────────────────────────── */
.rev { display: grid; grid-template-columns: minmax(0, 1fr) 260px; border: 1px solid var(--subtle); }
.rev__stage {
  background: var(--hero-bg);
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.2rem;
  position: relative;
}
.rev__img { max-width: 100%; max-height: 420px; object-fit: contain; display: block; }
.rev__seq {
  position: absolute;
  top: 0.9rem;
  left: 1.1rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.5);
}
.rev__done { font-family: var(--font-serif); font-size: 1.2rem; color: rgba(245, 244, 240, 0.7); }
.rev__rail { border-left: 1px solid var(--subtle); background: #fff; display: flex; flex-direction: column; }
.rev__body { padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; flex: 1; }
.rev__label {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.rev__who { font-family: var(--font-serif); font-size: 1rem; color: var(--dark); }
.rev__who--anon { color: var(--muted); font-style: italic; }
.rev__credit { font-family: var(--font-sans); font-size: 0.68rem; color: var(--muted); }
.rev__caption { font-family: var(--font-serif); font-size: 0.8rem; color: var(--dark); }
.rev__note {
  border-left: 2px solid var(--subtle);
  padding-left: 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--muted);
}
.rev__meta { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); }
.rev__acts { padding: 1rem; display: flex; flex-direction: column; gap: 0.4rem; border-top: 1px solid var(--subtle); }
.rev__acts .btn { justify-content: space-between; padding: 0.6rem 0.7rem; font-size: 0.5rem; }
.rev__key { opacity: 0.55; }

/* ── Grid ───────────────────────────────────────────────────────────────── */
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.9rem;
}
.tile {
  position: relative;
  border: 1px solid var(--subtle);
  background: #fff;
  display: flex;
  flex-direction: column;
}
.tile.is-selected { border-color: var(--accent); }
/* Spotlighted from a note's thumbnail — a ring, not the same border-color
   change as is-selected, so "picked for bulk action" and "here's the photo
   that note refers to" never read as the same state. */
.tile.is-highlighted { box-shadow: 0 0 0 3px var(--accent); z-index: 1; }
.tile.is-rejected .tile__img { filter: grayscale(1); opacity: 0.5; }
.tile.is-gone .tile__img { opacity: 0.75; }
.tile__pick {
  position: relative;
  border: none;
  padding: 0;
  background: none;
  cursor: pointer;
  display: block;
}
.tile__img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: var(--subtle);
}
.tile__check {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  width: 1.3rem;
  height: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: #fff;
  font-size: 0.8rem;
}
/* Sibling of .tile__pick, not nested inside it — a button inside a button
   is invalid HTML, and this needs its own click target independent of the
   select-toggle underneath it. */
.tile__preview {
  position: absolute;
  top: 0.4rem;
  left: 0.4rem;
  width: 1.5rem;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  background: rgba(26, 25, 24, 0.55);
  color: #fff;
  font-size: 0.72rem;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}
.tile:hover .tile__preview,
.tile__preview:focus-visible { opacity: 1; }
.tile__preview:hover { background: var(--accent); }
/* State reads as a label, not only a tint. */
.tile__flag {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.24rem 0.4rem;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: #fff;
  text-align: left;
}
.tile.is-approved .tile__flag { background: var(--accent); }
.tile.is-rejected .tile__flag { background: #B0243C; }
.tile.is-gone .tile__flag { background: #9A6B1F; }
.tile__foot { padding: 0.5rem 0.55rem; display: flex; flex-direction: column; gap: 0.28rem; }
.tile__by { font-family: var(--font-serif); font-size: 0.85rem; color: var(--dark); }
.tile__meta { font-family: var(--font-sans); font-size: 0.58rem; color: var(--muted); }
.tile__caption { font-family: var(--font-serif); font-size: 0.76rem; color: var(--muted); overflow-wrap: anywhere; }
.tile__dl { align-self: flex-start; margin-top: 0.2rem; }

/* ── Fullscreen preview ─────────────────────────────────────────────────── */
.preview {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--hero-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 3rem;
}
.preview__img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
.preview__meta {
  position: absolute;
  left: 1.1rem;
  bottom: 1rem;
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  font-family: var(--font-sans);
  color: rgba(245, 244, 240, 0.75);
}
.preview__who { font-family: var(--font-serif); font-size: 0.95rem; color: #F5F4F0; }
.preview__size { font-size: 0.62rem; letter-spacing: 0.08em; }
.preview__close,
.preview__nav {
  position: absolute;
  border: 1px solid rgba(245, 244, 240, 0.3);
  background: rgba(12, 12, 10, 0.5);
  color: #F5F4F0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.preview__close:hover,
.preview__nav:hover { border-color: var(--accent); color: var(--accent); }
.preview__close { top: 1rem; right: 1.1rem; width: 2.2rem; height: 2.2rem; font-size: 1rem; }
.preview__nav { top: 50%; transform: translateY(-50%); width: 2.6rem; height: 2.6rem; font-size: 1.1rem; }
.preview__nav--prev { left: 1.1rem; }
.preview__nav--next { right: 1.1rem; }

.pager { display: flex; align-items: center; gap: 0.6rem; }
.pager__at { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); }

/* ── Split: photos 60 / notes 40 ───────────────────────────────────────────
   A permanent layout, not a section — the grid narrows to make room rather
   than notes living somewhere you scroll to. Collapses to a slim rail so the
   grid can reclaim the width when nobody needs the notes on screen. */
.split { display: flex; align-items: flex-start; gap: 0; }
.split__photos {
  flex: 1 1 60%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.split__notes {
  flex: 0 0 40%;
  min-width: 0;
  position: relative;
  border-left: 1px solid var(--subtle);
  transition: flex-basis 0.22s ease;
}
.split.is-collapsed .split__photos { flex-basis: 100%; }
.split.is-collapsed .split__notes { flex-basis: 2.4rem; }

.split__notes-body { padding: 0.15rem 0.9rem 0.9rem 1rem; }
.split.is-collapsed .split__notes-body { display: none; }
.split__notes-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin: 0 0 0.7rem;
}
.split__notes-count {
  margin: 0;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.split__notes-count b { color: var(--dark); font-weight: 600; }

/* A proper button, not a floating circle on the seam — matches .btn's own
   register so it reads as "an action on this page", not a UI chrome widget. */
.split__collapse {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--subtle);
  background: none;
  padding: 0.3rem 0.55rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.split__collapse:hover { border-color: var(--accent); color: var(--accent); }
.split__collapse-icon {
  width: 0.35rem; height: 0.35rem;
  border-right: 1.4px solid currentColor;
  border-bottom: 1.4px solid currentColor;
  transform: rotate(-45deg);
}

/* Collapsed: the whole rail is the button — the label itself is the control,
   not a separate icon bolted onto muted text. */
.split__collapsed-rail {
  display: none;
  position: absolute;
  inset: 0;
  width: 100%;
  flex-direction: column;
  align-items: center;
  gap: 0.55rem;
  padding-top: 1.1rem;
  border: 0;
  background: none;
  cursor: pointer;
  transition: background-color 0.15s;
}
.split.is-collapsed .split__collapsed-rail { display: flex; }
.split__collapsed-rail:hover { background: var(--paper); }
.split__collapsed-count {
  width: 1.3rem; height: 1.3rem;
  background: var(--accent);
  color: #fff;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-sans);
  font-size: 0.6rem; font-weight: 600;
}
.split__collapsed-label {
  writing-mode: vertical-rl;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dark);
}
.split__collapsed-rail:hover .split__collapsed-label { color: var(--accent); }

/* ── Contributor note cards ─────────────────────────────────────────────── */
.cardlist { display: flex; flex-direction: column; gap: 0.6rem; }
.ncard {
  border: 1px solid var(--subtle);
  border-left: 2px solid var(--accent);
  background: #fff;
  padding: 0.75rem 0.85rem;
}
.ncard__body { display: flex; flex-direction: column; gap: 0.4rem; }
.ncard__head { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
.ncard__name { font-family: var(--font-serif); font-size: 0.94rem; color: var(--dark); }
.ncard__name--anon { font-style: italic; color: var(--muted); }
.ncard__count {
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.ncard__note {
  margin: 0;
  border-left: 2px solid var(--subtle);
  padding-left: 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.76rem;
  line-height: 1.55;
  color: var(--dark);
}
.ncard__photos { display: flex; align-items: center; gap: 0.3rem; margin-top: 0.1rem; }
.ncard__thumb {
  width: 2.2rem; height: 2.2rem;
  flex: none;
  padding: 0;
  border: 1px solid var(--subtle);
  background: none;
  cursor: pointer;
  transition: border-color 0.15s;
}
.ncard__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ncard__thumb:hover { border-color: var(--accent); }
.ncard__thumb.is-active { border: 2px solid var(--accent); }
.ncard__thumb-more {
  width: 2.2rem; height: 2.2rem;
  display: flex; align-items: center; justify-content: center;
  background: var(--paper);
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--muted);
}

.btn {
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.32rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  transition: border-color 0.15s, color 0.15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn--primary { border-color: var(--dark); }
.btn--danger { border-color: var(--accent); color: var(--accent); }
/* Approve/Reject/Delete are three different consequences and read as one
   grey blur otherwise. Reject reuses the amber this page already uses for
   "diverged/removed" states — soft and reversible, unlike Delete's accent
   pink, which stays reserved for the one truly destructive action. */
.btn--approve { border-color: #2F6B4F; color: #2F6B4F; }
.btn--approve:hover { border-color: #24543D; color: #24543D; }
.btn--reject { border-color: #9A6B1F; color: #9A6B1F; }
.btn--reject:hover { border-color: #7A5518; color: #7A5518; }

@media (max-width: 820px) {
  .rev { grid-template-columns: 1fr; }
  .rev__rail { border-left: none; border-top: 1px solid var(--subtle); }
  .dest { grid-template-columns: 1fr; }
}
</style>
