<script setup lang="ts">
import type { Album, AlbumInput } from '~~/shared/types'
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()
const busy = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

// Album-first: a real draft row is created up front so images upload straight
// into content-albums/<id>/ (their permanent home). Saving is a plain PUT — no
// post-save R2 migration. The draft id is remembered so reloading the page
// reuses the same draft instead of leaking a new empty one each time.
const draftStorageKey = 'cu-photo-draft-album-id'
const draftId = ref<string | null>(null)
const mediaPrefix = ref('')
const ready = ref(false)

async function ensureDraft() {
  const savedId = localStorage.getItem(draftStorageKey)
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
  localStorage.setItem(draftStorageKey, draft.id)
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
  localStorage.removeItem(draftStorageKey)
  $fetch(`/api/admin/albums/${draftId.value}`, { method: 'DELETE' }).catch(() => {})
})

async function save(value: AlbumInput) {
  if (!draftId.value) return
  busy.value = true
  saveError.value = null
  try {
    await $fetch(`/api/admin/albums/${draftId.value}`, { method: 'PUT', body: value })
    saved.value = true
    localStorage.removeItem(draftStorageKey)
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
