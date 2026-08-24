<script setup lang="ts">
// The pool: everything participants have sent, admin-only.
//
// There is no review queue here on purpose — nothing in the pool is public, so
// there is nothing to moderate *for*. The only decisions are consolidate (into
// an album), download (for Instagram/Facebook) and delete.
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()

interface PoolItem {
  id: string
  eventId: number
  caption: string | null
  size: number
  publishedTo: string | null
  createdAt: string
  displayName: string | null
  contact: string | null
  previewUrl: string
  downloadUrl: string
}
interface Pool {
  total: number
  page: number
  perPage: number
  pageCount: number
  items: PoolItem[]
}
interface EventOption { id: number, title: string }

useHead(() => ({ title: t('adminPool.title') }))

const eventId = computed(() => Number(route.query.eventId) || 0)
const usedFilter = computed(() => String(route.query.used || 'all'))
const page = computed(() => Number(route.query.page) || 1)

const { data: events } = await useFetch<EventOption[]>('/api/admin/events')

const query = computed(() => ({
  ...(eventId.value ? { eventId: eventId.value } : {}),
  used: usedFilter.value,
  page: page.value
}))
const { data: pool, refresh } = await useFetch<Pool>('/api/admin/submissions', { query })

function setQuery(patch: Record<string, string | number | undefined>) {
  router.push({ query: { ...route.query, page: undefined, ...patch } })
}

const selected = ref(new Set<string>())
const busy = ref(false)
const error = ref('')
const notice = ref('')

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}
function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}
function selectAllOnPage() {
  selected.value = new Set(pool.value?.items.map(item => item.id) ?? [])
}
function clearSelection() {
  selected.value = new Set()
}

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

const consolidateOpen = ref(false)
const albumTitle = ref('')

async function consolidate() {
  if (!selected.value.size || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const result = await $fetch<{ count: number, album: { slug: string, title: string } }>(
      '/api/admin/submissions/consolidate',
      { method: 'POST', body: { ids: [...selected.value], title: albumTitle.value || undefined } }
    )
    notice.value = t('adminPool.consolidated', {
      count: result.count,
      album: result.album.title || result.album.slug
    })
    albumTitle.value = ''
    consolidateOpen.value = false
    clearSelection()
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminPool.consolidateFailed'))
  } finally {
    busy.value = false
  }
}

// Must match MAX_PER_RUN in the consolidate endpoint: each photo costs two R2
// round trips, against a 50-subrequest ceiling.
const CONSOLIDATE_MAX = 15
const overBatch = computed(() => selected.value.size > CONSOLIDATE_MAX)

function kb(bytes: number) {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(1)} MB` : `${Math.round(bytes / 1000)} KB`
}
</script>

<template>
  <div class="pool">
    <header class="pool__head">
      <h1 class="pool__title">{{ t('adminPool.title') }}</h1>
      <p class="pool__sub">{{ t('adminPool.sub') }}</p>
    </header>

    <div class="pool__filters">
      <label class="f">
        <span class="f__label">{{ t('adminPool.event') }}</span>
        <select
          class="f__input"
          :value="eventId || ''"
          @change="setQuery({ eventId: Number(($event.target as HTMLSelectElement).value) || undefined })"
        >
          <option value="">{{ t('adminPool.allEvents') }}</option>
          <option v-for="ev in events" :key="ev.id" :value="ev.id">{{ ev.title }}</option>
        </select>
      </label>
      <label class="f">
        <span class="f__label">{{ t('adminPool.show') }}</span>
        <select
          class="f__input"
          :value="usedFilter"
          @change="setQuery({ used: ($event.target as HTMLSelectElement).value })"
        >
          <option value="all">{{ t('adminPool.showAll') }}</option>
          <option value="unused">{{ t('adminPool.showUnused') }}</option>
          <option value="used">{{ t('adminPool.showUsed') }}</option>
        </select>
      </label>
      <span class="pool__count">{{ t('adminPool.total', { n: pool?.total ?? 0 }) }}</span>
    </div>

    <p v-if="error" class="pool__error">{{ error }}</p>
    <p v-if="notice" class="pool__notice">{{ notice }}</p>

    <div v-if="selected.size" class="bar">
      <span class="bar__count">{{ t('adminPool.selected', { n: selected.size }) }}</span>
      <button type="button" class="btn" @click="clearSelection">{{ t('adminPool.clear') }}</button>
      <button type="button" class="btn" :disabled="busy || overBatch" @click="consolidateOpen = !consolidateOpen">
        {{ t('adminPool.consolidate') }}
      </button>
      <button
        v-if="!confirmDelete"
        type="button"
        class="btn"
        @click="confirmDelete = true"
      >{{ t('adminPool.delete') }}</button>
      <template v-else>
        <button type="button" class="btn btn--danger" :disabled="busy" @click="deleteSelected">
          {{ t('adminPool.confirmDelete') }}
        </button>
        <button type="button" class="btn" @click="confirmDelete = false">{{ t('adminPool.cancel') }}</button>
      </template>
      <span v-if="overBatch" class="bar__warn">{{ t('adminPool.batchLimit', { max: CONSOLIDATE_MAX }) }}</span>
    </div>

    <div v-if="consolidateOpen" class="consolidate">
      <label class="f">
        <span class="f__label">{{ t('adminPool.albumTitle') }}</span>
        <input v-model="albumTitle" class="f__input" type="text" maxlength="200" :placeholder="t('adminPool.albumTitlePlaceholder')">
      </label>
      <button type="button" class="btn btn--primary" :disabled="busy" @click="consolidate">
        {{ busy ? t('adminPool.working') : t('adminPool.createAlbum') }}
      </button>
      <p class="consolidate__note">{{ t('adminPool.consolidateNote') }}</p>
    </div>

    <div v-if="pool?.items.length" class="pool__toolbar">
      <button type="button" class="btn" @click="selectAllOnPage">{{ t('adminPool.selectPage') }}</button>
    </div>

    <ul v-if="pool?.items.length" class="grid">
      <li
        v-for="item in pool.items"
        :key="item.id"
        class="tile"
        :class="{ 'is-selected': selected.has(item.id), 'is-used': item.publishedTo }"
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
        </button>
        <div class="tile__foot">
          <span class="tile__by">{{ item.displayName || t('adminPool.anonymous') }}</span>
          <span class="tile__meta">{{ kb(item.size) }}</span>
          <span v-if="item.publishedTo" class="tile__used">{{ item.publishedTo }}</span>
          <p v-if="item.caption" class="tile__caption">{{ item.caption }}</p>
          <a class="btn tile__dl" :href="item.downloadUrl">{{ t('adminPool.download') }}</a>
        </div>
      </li>
    </ul>

    <p v-else class="pool__empty">{{ t('adminPool.empty') }}</p>

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
.pool__title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  color: var(--dark);
}
.pool__sub { font-family: var(--font-sans); font-size: 0.72rem; color: var(--muted); max-width: 62ch; }

.pool__filters { display: flex; gap: 0.9rem; align-items: end; flex-wrap: wrap; }
.pool__count { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); padding-bottom: 0.4rem; }

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
.bar__warn { font-family: var(--font-sans); font-size: 0.62rem; color: var(--accent); }

.consolidate {
  display: flex;
  gap: 0.7rem;
  align-items: end;
  flex-wrap: wrap;
  padding: 0.8rem;
  border: 1px solid var(--subtle);
  background: var(--paper);
}
.consolidate__note {
  flex-basis: 100%;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  color: var(--muted);
}

.pool__toolbar { display: flex; gap: 0.4rem; }

.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 0.9rem;
}
.tile {
  border: 1px solid var(--subtle);
  background: #fff;
  display: flex;
  flex-direction: column;
}
.tile.is-selected { border-color: var(--accent); }
.tile.is-used { opacity: 0.72; }
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
.tile__foot { padding: 0.5rem 0.55rem; display: flex; flex-direction: column; gap: 0.28rem; }
.tile__by { font-family: var(--font-serif); font-size: 0.85rem; color: var(--dark); }
.tile__meta,
.tile__used { font-family: var(--font-sans); font-size: 0.58rem; color: var(--muted); }
.tile__used { color: var(--accent); overflow-wrap: anywhere; }
.tile__caption { font-family: var(--font-serif); font-size: 0.76rem; color: var(--muted); overflow-wrap: anywhere; }
.tile__dl { align-self: flex-start; margin-top: 0.2rem; }

.pager { display: flex; align-items: center; gap: 0.6rem; }
.pager__at { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); }

.f { display: flex; flex-direction: column; gap: 0.25rem; }
.f__label {
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.f__input {
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.4rem 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  color: var(--dark);
  min-width: 12rem;
}
.f__input:focus { outline: none; border-color: var(--accent); }

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
  transition: border-color 0.15s, color 0.15s;
}
.btn:hover { border-color: var(--accent); color: var(--accent); }
.btn:disabled { opacity: 0.5; cursor: default; }
.btn--primary { border-color: var(--dark); }
.btn--danger { border-color: var(--accent); color: var(--accent); }
</style>
