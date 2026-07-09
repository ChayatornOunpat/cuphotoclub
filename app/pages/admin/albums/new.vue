<script setup lang="ts">
import type { Album, AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const { user } = useUserSession()
const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

// Album-first: a real draft row is created up front so images upload straight
// into content-albums/<id>/ (their permanent home). Saving is a plain PUT — no
// post-save R2 migration. The draft id is remembered so reloading the page
// reuses the same draft on reload. The stored id is keyed by a per-page draft
// token so one admin can safely compose multiple new albums in separate tabs.
const legacyDraftStorageKey = 'cu-photo-draft-album-id'
const draftStoragePrefix = 'cu-photo-draft-album'
const draftId = ref<string | null>(null)
const draftToken = ref('')
const mediaPrefix = ref('')
const ready = ref(false)

type StoredDraft = {
  albumId: string
  ownerKey: string
}

function currentDraftOwnerKey() {
  return String(user.value?.id || user.value?.email || '').trim()
}

function normalizeDraftToken(value: unknown) {
  const token = Array.isArray(value) ? value[0] : value
  const normalized = typeof token === 'string' ? token.trim() : ''
  return /^[a-z0-9_-]{8,80}$/i.test(normalized) ? normalized : ''
}

function draftStorageKey(token = draftToken.value) {
  return token ? `${draftStoragePrefix}:${token}` : ''
}

async function ensureDraftToken() {
  const existing = normalizeDraftToken(route.query.draft)
  if (existing) {
    draftToken.value = existing
    return existing
  }

  const token = crypto.randomUUID()
  draftToken.value = token
  await router.replace({ query: { ...route.query, draft: token } })
  return token
}

function readStoredDraftId(token: string) {
  const key = draftStorageKey(token)
  if (!key) return null
  const raw = localStorage.getItem(key)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDraft>
    const ownerKey = currentDraftOwnerKey()
    const albumId = typeof parsed.albumId === 'string' ? parsed.albumId : ''
    const storedOwner = typeof parsed.ownerKey === 'string' ? parsed.ownerKey : ''

    if (!albumId || !ownerKey || storedOwner !== ownerKey) {
      localStorage.removeItem(key)
      return null
    }

    return albumId
  } catch {
    localStorage.removeItem(key)
    return null
  }
}

function writeStoredDraftId(token: string, albumId: string) {
  const key = draftStorageKey(token)
  const ownerKey = currentDraftOwnerKey()
  if (!key || !ownerKey) return
  localStorage.setItem(key, JSON.stringify({ albumId, ownerKey } satisfies StoredDraft))
}

function removeStoredDraftId() {
  const key = draftStorageKey()
  if (key) localStorage.removeItem(key)
}

async function ensureDraft() {
  localStorage.removeItem(legacyDraftStorageKey)
  const token = await ensureDraftToken()
  const savedId = readStoredDraftId(token)
  if (savedId) {
    const existing = await $fetch<Album>(`/api/admin/albums/${savedId}`).catch(() => null)
    if (existing?.id) {
      draftId.value = existing.id
      mediaPrefix.value = `content-albums/${existing.id}`
      ready.value = true
      return
    }
  }
  const draft = await $fetch<{ id: string, slug: string, mediaPrefix: string }>('/api/admin/albums/draft', { method: 'POST' })
  draftId.value = draft.id
  mediaPrefix.value = draft.mediaPrefix
  writeStoredDraftId(token, draft.id)
  ready.value = true
}

onMounted(() => {
  ensureDraft().catch(() => {
    saveError.value = t('admin.saveFailed')
  })
})

// Cancelling album creation: if the user navigates away without ever saving,
// remove the empty draft row so it doesn't linger in the albums list. This runs
// on unmount — i.e. only after the form's own unsaved-changes guard let the
// navigation through. A reload/crash doesn't unmount, so the localStorage
// resume path (ensureDraft above) still recovers the draft in that case.
// Uploaded files stay in R2; without the album row they surface as
// unreferenced in the R2 admin for cleanup.
onUnmounted(() => {
  if (saved.value || !draftId.value) return
  removeStoredDraftId()
  $fetch(`/api/admin/albums/${draftId.value}`, { method: 'DELETE' }).catch(() => {})
})

async function save(value: AlbumInput) {
  if (!draftId.value) return
  busy.value = true
  saveError.value = null
  try {
    await $fetch(`/api/admin/albums/${draftId.value}`, { method: 'PUT', body: value })
    saved.value = true
    removeStoredDraftId()
    await navigateTo(localePath('/admin/albums'))
  } catch (e) {
    saveError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.saveFailed')
  } finally {
    busy.value = false
  }
}

useHead({ title: () => `${t('admin.newAlbum')} — Admin` })
</script>

<template>
  <AdminAlbumForm v-if="ready" :media-prefix="mediaPrefix" :submit-label="t('admin.createAlbum')" :busy="busy" :error="saveError" :saved="saved" @submit="save" />
  <p v-else class="album-new__loading">{{ t('admin.loading') }}</p>
</template>

<style scoped>
.album-new__loading {
  padding: 3rem 1.5rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
</style>
