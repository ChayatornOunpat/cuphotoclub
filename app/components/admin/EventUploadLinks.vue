<script setup lang="ts">
// Collection links for one event: create, share, tune, close.
// Closing is the important one — it ends uploading *and* contributor editing,
// which is the whole permission model (docs/event-photo-submissions.md).
const props = defineProps<{ eventId: number }>()

const { t } = useI18n()
const localePath = useLocalePath()

interface UploadLink {
  id: string
  label: string | null
  status: 'open' | 'closed'
  open: boolean
  requireName: boolean
  maxPerContributor: number
  maxTotal: number
  compress: boolean
  compressMaxDim: number
  compressQuality: number
  maxBytesPerPhoto: number
  expiresAt: string | null
  photoCount: number
  contributorCount: number
}

const endpoint = computed(() => `/api/admin/events/${props.eventId}/upload-links`)
const { data: links, refresh } = await useFetch<UploadLink[]>(endpoint)

const busy = ref(false)
const error = ref('')
const copiedId = ref('')
const editingId = ref('')

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}

// Presets keep the admin out of raw quality numbers; the stored columns are
// still plain values, so anything can be nudged later without a migration.
const PRESETS = [
  { key: 'small', dim: 2048, quality: 80, bytes: 2 * 1024 * 1024 },
  { key: 'balanced', dim: 3040, quality: 85, bytes: 6 * 1024 * 1024 },
  { key: 'high', dim: 4096, quality: 92, bytes: 10 * 1024 * 1024 }
] as const

const form = reactive({
  label: '',
  requireName: false,
  maxPerContributor: 100,
  maxTotal: 2000,
  preset: 'balanced' as (typeof PRESETS)[number]['key']
})

function presetValues(key: string) {
  return PRESETS.find(p => p.key === key) ?? PRESETS[1]
}

async function createLink() {
  if (busy.value) return
  // Same guard as patchNumber: clearing a number input yields NaN via
  // v-model.number, which the server would reject — or worse, read as 0.
  if (!Number.isFinite(form.maxPerContributor) || form.maxPerContributor < 1
    || !Number.isFinite(form.maxTotal) || form.maxTotal < 1) {
    error.value = t('adminUploadLinks.needsNumber')
    return
  }
  error.value = ''
  try {
    const preset = presetValues(form.preset)
    await $fetch(endpoint.value, {
      method: 'POST',
      body: {
        label: form.label || undefined,
        requireName: form.requireName,
        maxPerContributor: Math.trunc(form.maxPerContributor),
        maxTotal: Math.trunc(form.maxTotal),
        compress: true,
        compressMaxDim: preset.dim,
        compressQuality: preset.quality,
        maxBytesPerPhoto: preset.bytes
      }
    })
    form.label = ''
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminUploadLinks.createFailed'))
  } finally {
    busy.value = false
  }
}

async function patchLink(link: UploadLink, body: Record<string, unknown>) {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`${endpoint.value}/${link.id}`, { method: 'PATCH', body })
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminUploadLinks.saveFailed'))
  } finally {
    busy.value = false
  }
}

// useSiteOrigin() reads the configured site URL, so this renders identically on
// server and client (no hydration mismatch) and the copied link points at the
// real site even when an admin is on localhost.
const origin = useSiteOrigin()
// Clearing a number input gives '', and Number('') is 0 — which the server
// would reject, or worse silently accept as a limit of zero.
function patchNumber(link: UploadLink, field: 'maxPerContributor' | 'maxTotal', e: Event) {
  const raw = (e.target as HTMLInputElement).value.trim()
  const value = Number(raw)
  if (!raw || !Number.isFinite(value) || value < 1) {
    error.value = t('adminUploadLinks.needsNumber')
    return
  }
  return patchLink(link, { [field]: Math.trunc(value) })
}

function publicUrl(link: UploadLink) {
  return `${origin}${localePath(`/contribute/${link.id}`)}`
}

async function copyLink(link: UploadLink) {
  try {
    await navigator.clipboard.writeText(publicUrl(link))
    copiedId.value = link.id
    setTimeout(() => { copiedId.value = '' }, 1600)
  } catch {
    // Clipboard unavailable — the URL is shown in full next to the button.
  }
}

function mb(bytes: number) {
  return Math.round(bytes / (1024 * 1024))
}
</script>

<template>
  <section class="eul">
    <header class="eul__head">
      <h2 class="eul__title">{{ t('adminUploadLinks.title') }}</h2>
      <p class="eul__sub">{{ t('adminUploadLinks.sub') }}</p>
    </header>

    <p v-if="error" class="eul__error">{{ error }}</p>

    <ul v-if="links?.length" class="eul__list">
      <li v-for="link in links" :key="link.id" class="row">
        <div class="row__main">
          <span class="row__label">{{ link.label || t('adminUploadLinks.untitled') }}</span>
          <span class="row__pill" :class="link.open ? 'row__pill--open' : 'row__pill--closed'">
            {{ link.open ? t('adminUploadLinks.open') : t('adminUploadLinks.closed') }}
          </span>
          <span class="row__stat">
            {{ t('adminUploadLinks.stats', { photos: link.photoCount, people: link.contributorCount }) }}
          </span>
        </div>

        <div class="row__url">
          <code class="row__code">{{ publicUrl(link) }}</code>
          <button type="button" class="btn" @click="copyLink(link)">
            {{ copiedId === link.id ? t('adminUploadLinks.copied') : t('adminUploadLinks.copy') }}
          </button>
        </div>

        <div class="row__meta">
          {{ t('adminUploadLinks.policy', {
            perPerson: link.maxPerContributor,
            dim: link.compressMaxDim,
            quality: link.compressQuality,
            mb: mb(link.maxBytesPerPhoto)
          }) }}
          <span v-if="link.requireName"> · {{ t('adminUploadLinks.nameRequired') }}</span>
        </div>

        <div class="row__actions">
          <button
            type="button"
            class="btn"
            :disabled="busy"
            @click="patchLink(link, { status: link.status === 'open' ? 'closed' : 'open' })"
          >
            {{ link.status === 'open' ? t('adminUploadLinks.closeLink') : t('adminUploadLinks.reopen') }}
          </button>
          <button type="button" class="btn" @click="editingId = editingId === link.id ? '' : link.id">
            {{ t('adminUploadLinks.limits') }}
          </button>
          <NuxtLink class="btn" :to="localePath(`/admin/submissions?eventId=${props.eventId}`)">
            {{ t('adminUploadLinks.viewPool') }}
          </NuxtLink>
        </div>

        <div v-if="editingId === link.id" class="row__edit">
          <label class="f">
            <span class="f__label">{{ t('adminUploadLinks.perPerson') }}</span>
            <input
              class="f__input"
              type="number"
              min="1"
              max="1000"
              :value="link.maxPerContributor"
              @change="patchNumber(link, 'maxPerContributor', $event)"
            >
          </label>
          <label class="f">
            <span class="f__label">{{ t('adminUploadLinks.perEvent') }}</span>
            <input
              class="f__input"
              type="number"
              min="1"
              max="20000"
              :value="link.maxTotal"
              @change="patchNumber(link, 'maxTotal', $event)"
            >
          </label>
          <label class="f f--check">
            <input
              type="checkbox"
              :checked="link.requireName"
              @change="patchLink(link, { requireName: ($event.target as HTMLInputElement).checked })"
            >
            <span class="f__label">{{ t('adminUploadLinks.requireName') }}</span>
          </label>
        </div>
      </li>
    </ul>

    <p v-else class="eul__empty">{{ t('adminUploadLinks.none') }}</p>

    <div class="eul__create">
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.newLabel') }}</span>
        <input v-model="form.label" class="f__input" type="text" maxlength="200" :placeholder="t('adminUploadLinks.newLabelPlaceholder')">
      </label>
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.perPerson') }}</span>
        <input v-model.number="form.maxPerContributor" class="f__input" type="number" min="1" max="1000">
      </label>
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.quality') }}</span>
        <select v-model="form.preset" class="f__input">
          <option v-for="p in PRESETS" :key="p.key" :value="p.key">
            {{ t(`adminUploadLinks.preset_${p.key}`) }} · {{ p.dim }}px · {{ p.quality }}% · {{ mb(p.bytes) }}MB
          </option>
        </select>
      </label>
      <button type="button" class="btn btn--primary" :disabled="busy" @click="createLink">
        {{ t('adminUploadLinks.create') }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.eul {
  border: 1px solid var(--subtle);
  background: var(--paper);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.eul__head { display: flex; flex-direction: column; gap: 0.25rem; }
.eul__title {
  font-family: var(--font-sans);
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--dark);
}
.eul__sub { font-family: var(--font-sans); font-size: 0.68rem; color: var(--muted); }
.eul__error {
  border-left: 2px solid var(--accent);
  padding: 0.5rem 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--dark);
  background: #fff;
}
.eul__empty { font-family: var(--font-sans); font-size: 0.72rem; color: var(--muted); }

.eul__list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.8rem; }
.row {
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.row__main { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.row__label { font-family: var(--font-serif); font-size: 0.95rem; color: var(--dark); }
.row__pill {
  font-family: var(--font-sans);
  font-size: 0.42rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 0.15rem 0.4rem;
  border: 1px solid var(--subtle);
}
.row__pill--open { color: var(--accent); border-color: var(--accent); }
.row__pill--closed { color: var(--muted); }
.row__stat { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); }

.row__url { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.row__code {
  font-family: var(--font-latin-sans);
  font-size: 0.68rem;
  color: var(--dark);
  background: var(--paper);
  padding: 0.2rem 0.4rem;
  overflow-wrap: anywhere;
}
.row__meta { font-family: var(--font-sans); font-size: 0.62rem; color: var(--muted); }
.row__actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.row__edit {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.6rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--subtle);
}

.eul__create {
  display: grid;
  grid-template-columns: 2fr 1fr 2fr auto;
  gap: 0.6rem;
  align-items: end;
  padding-top: 0.9rem;
  border-top: 1px solid var(--subtle);
}
.f { display: flex; flex-direction: column; gap: 0.25rem; }
.f--check { flex-direction: row; align-items: center; gap: 0.4rem; }
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

@media (max-width: 820px) {
  .eul__create { grid-template-columns: 1fr; }
}
</style>
