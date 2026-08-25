<script setup lang="ts">
// Photo collections: create, share, tune, close. Standalone — nothing ties a
// collection to an event or activity. Closing is the important one — it ends
// uploading *and* contributor editing, which is the whole permission model
// (docs/event-photo-submissions.md).

const { t } = useI18n()
const localePath = useLocalePath()

interface CollectionLink {
  id: string
  label: string
  description: string | null
  coverR2Key: string | null
  eventDate: string | null
  location: string | null
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

const endpoint = '/api/admin/upload-links'
const { data: links, refresh } = await useFetch<CollectionLink[]>(endpoint)

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
  description: '',
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
  // The label is the collection's name — required. Without it the overview
  // becomes unfindable once several links exist, and it is the title
  // participants see on the contribute page.
  if (!form.label.trim()) {
    error.value = t('adminUploadLinks.needsName')
    return
  }
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
    await $fetch(endpoint, {
      method: 'POST',
      body: {
        label: form.label.trim(),
        description: form.description.trim() || undefined,
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
    form.description = ''
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminUploadLinks.createFailed'))
  } finally {
    busy.value = false
  }
}

const confirmTarget = ref<CollectionLink | null>(null)
const notice = ref('')

// Deleting takes the link, its contributors and every submission row with it.
// The photo *files* stay in R2 and become unreferenced — same as deleting an
// album — so say so afterwards and point at where they get cleared, otherwise
// the storage quietly fills up with nobody knowing why.
async function deleteLink() {
  const link = confirmTarget.value
  if (!link || busy.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await $fetch<{ photoCount: number }>(`${endpoint}/${link.id}`, { method: 'DELETE' })
    confirmTarget.value = null
    if (editingId.value === link.id) editingId.value = ''
    notice.value = res.photoCount > 0
      ? t('adminUploadLinks.deletedWithPhotos', { label: link.label, count: res.photoCount })
      : t('adminUploadLinks.deleted', { label: link.label })
    await refresh()
  } catch (e) {
    error.value = errMsg(e, t('adminUploadLinks.deleteFailed'))
  } finally {
    busy.value = false
  }
}

async function patchLink(link: CollectionLink, body: Record<string, unknown>) {
  busy.value = true
  error.value = ''
  try {
    await $fetch(`${endpoint}/${link.id}`, { method: 'PATCH', body })
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
function patchNumber(link: CollectionLink, field: 'maxPerContributor' | 'maxTotal', e: Event) {
  const raw = (e.target as HTMLInputElement).value.trim()
  const value = Number(raw)
  if (!raw || !Number.isFinite(value) || value < 1) {
    error.value = t('adminUploadLinks.needsNumber')
    return
  }
  return patchLink(link, { [field]: Math.trunc(value) })
}

function publicUrl(link: CollectionLink) {
  return `${origin}${localePath(`/contribute/${link.id}`)}`
}

async function copyLink(link: CollectionLink) {
  try {
    await navigator.clipboard.writeText(publicUrl(link))
    copiedId.value = link.id
    setTimeout(() => { copiedId.value = '' }, 1600)
  } catch {
    // Clipboard unavailable — the URL is shown in full next to the button.
  }
}

// Date · place, both optional. formatDate is the site's one date formatter
// (app/utils/format.ts) — the same dd/mm/yy the albums table uses, read in UTC.
function metaLine(link: CollectionLink) {
  const parts: string[] = []
  if (link.eventDate) parts.push(formatDate(link.eventDate))
  if (link.location) parts.push(link.location)
  return parts.join(' · ')
}

// <input type="date"> only accepts yyyy-MM-dd, but the API returns ISO. Slice
// in UTC to match how the contribute page formats it — using the local date
// parts would shift the day either side of midnight.
function dateInput(value: string | null) {
  if (!value) return ''
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}
</script>

<template>
  <section class="eul">
    <!-- Creation first: opening a collection is the page's primary action; the
         list of existing links follows below. -->
    <div class="eul__create">
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.newLabel') }}</span>
        <input v-model="form.label" class="f__input" type="text" maxlength="200" required :placeholder="t('adminUploadLinks.newLabelPlaceholder')">
      </label>
      <label class="f f--wide">
        <span class="f__label">{{ t('adminUploadLinks.newDescription') }}</span>
        <input v-model="form.description" class="f__input" type="text" maxlength="500" :placeholder="t('adminUploadLinks.newDescriptionPlaceholder')">
      </label>
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.perPerson') }}</span>
        <input v-model.number="form.maxPerContributor" class="f__input" type="number" min="1" max="1000">
      </label>
      <label class="f">
        <span class="f__label">{{ t('adminUploadLinks.quality') }}</span>
        <select v-model="form.preset" class="f__input">
          <option v-for="p in PRESETS" :key="p.key" :value="p.key">
            {{ t(`adminUploadLinks.preset_${p.key}`) }} · {{ p.dim }}px · {{ p.quality }}%
          </option>
        </select>
      </label>
      <button type="button" class="btn btn--primary" :disabled="busy" @click="createLink">
        {{ t('adminUploadLinks.create') }}
      </button>
    </div>

    <p v-if="error" class="eul__error">{{ error }}</p>
    <p v-if="notice" class="eul__notice">{{ notice }}</p>

    <ul v-if="links?.length" class="eul__list">
      <li v-for="link in links" :key="link.id" class="row">
        <div class="row__card">
          <!-- Cover first: it is how an admin recognises a collection before
               reading anything. Without one the slot still holds its shape, so
               the identity column never shifts left on some rows. -->
          <div class="row__cover">
            <img v-if="link.coverR2Key" class="row__img" :src="`/images/${link.coverR2Key}`" :alt="link.label" loading="lazy">
            <div v-else class="row__cover-empty">
              <span class="row__cover-label">{{ t('adminUploadLinks.noCover') }}</span>
            </div>
          </div>

          <div class="row__body">
            <p class="row__meta" :class="{ 'row__meta--empty': !metaLine(link) }">
              {{ metaLine(link) || t('adminUploadLinks.noDate') }}
            </p>
            <h3 class="row__label">{{ link.label }}</h3>

            <div class="row__url">
              <code class="row__code">{{ publicUrl(link) }}</code>
              <button
                type="button"
                class="icon-chip"
                :class="{ 'is-copied': copiedId === link.id }"
                :title="copiedId === link.id ? t('adminUploadLinks.copied') : t('adminUploadLinks.copy')"
                :aria-label="copiedId === link.id ? t('adminUploadLinks.copied') : t('adminUploadLinks.copy')"
                @click="copyLink(link)"
              >
                <Icon :name="copiedId === link.id ? 'heroicons:check' : 'heroicons:link'" class="icon-chip__icon" />
              </button>
            </div>

            <div class="row__actions">
              <NuxtLink class="link" :to="localePath(`/admin/submissions/${link.id}`)">
                {{ t('adminUploadLinks.viewPool') }}
              </NuxtLink>
              <button type="button" class="link" @click="editingId = editingId === link.id ? '' : link.id">
                {{ t('adminUploadLinks.limits') }}
              </button>
              <button
                type="button"
                class="link"
                :disabled="busy"
                @click="patchLink(link, { status: link.status === 'open' ? 'closed' : 'open' })"
              >
                {{ link.status === 'open' ? t('adminUploadLinks.closeLink') : t('adminUploadLinks.reopen') }}
              </button>
              <!-- Confirmation lives in a dialog, not a second button in this row:
                   the neighbours are all harmless, so a mis-aimed second tap must
                   not be able to land on "yes". -->
              <button
                type="button"
                class="link link--del"
                :disabled="busy"
                @click="confirmTarget = link"
              >
                {{ t('adminUploadLinks.delete') }}
              </button>
            </div>
          </div>

          <div class="row__state">
            <span class="row__pill" :class="link.open ? 'row__pill--open' : 'row__pill--closed'">
              {{ link.open ? t('adminUploadLinks.open') : t('adminUploadLinks.closed') }}
            </span>
            <div class="row__figures">
              <!-- A zero is drawn in --subtle rather than --muted so an empty
                   collection reads as empty without stopping to read digits. -->
              <div class="row__figure">
                <span class="row__num" :class="{ 'row__num--zero': !link.photoCount }">{{ link.photoCount }}</span>
                <span class="row__figure-label">{{ t('adminUploadLinks.photosLabel') }}</span>
              </div>
              <div class="row__figure">
                <span class="row__num" :class="{ 'row__num--zero': !link.contributorCount }">{{ link.contributorCount }}</span>
                <span class="row__figure-label">{{ t('adminUploadLinks.peopleLabel') }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="editingId === link.id" class="row__edit">
          <!-- Cover gets its own rail. As a full-width row capped at 320px it
               left most of the panel empty, which is what made this panel read
               as unfinished. Optional: collections are standalone, so there is
               no event cover to inherit — without one the page draws a gradient. -->
          <div class="edit__cover">
            <span class="f__label">{{ t('adminUploadLinks.cover') }}</span>
            <AdminCoverUploader
              :model-value="link.coverR2Key"
              prefix="covers/collections"
              :allow-library="false"
              aspect="aspect-[3/2]"
              @update:model-value="value => patchLink(link, { coverR2Key: value ?? null })"
            />
            <span class="f__hint">{{ t('adminUploadLinks.coverHint') }}</span>
          </div>

          <!-- Three clusters rather than one undifferentiated grid: fields that
               answer the same question sit together, and the space between
               groups is what separates them — no boxes, no rules. -->
          <div class="edit__groups">
            <div class="grp">
              <span class="grp__head">{{ t('adminUploadLinks.groupDetails') }}</span>
              <label class="f">
                <span class="f__label">{{ t('adminUploadLinks.newLabel') }}</span>
                <input
                  class="f__input"
                  type="text"
                  maxlength="200"
                  :value="link.label"
                  @change="patchLink(link, { label: String(($event.target as HTMLInputElement).value).trim() || undefined })"
                >
              </label>
              <label class="f">
                <span class="f__label">{{ t('adminUploadLinks.newDescription') }}</span>
                <input
                  class="f__input"
                  type="text"
                  maxlength="500"
                  :value="link.description ?? ''"
                  :placeholder="t('adminUploadLinks.newDescriptionPlaceholder')"
                  @change="patchLink(link, { description: String(($event.target as HTMLInputElement).value).trim() || null })"
                >
              </label>
            </div>

            <div class="grp">
              <span class="grp__head">{{ t('adminUploadLinks.groupWhen') }}</span>
              <label class="f">
                <span class="f__label">{{ t('adminUploadLinks.date') }}</span>
                <input
                  class="f__input"
                  type="date"
                  :value="dateInput(link.eventDate)"
                  @change="patchLink(link, { eventDate: String(($event.target as HTMLInputElement).value) || null })"
                >
              </label>
              <label class="f">
                <span class="f__label">{{ t('adminUploadLinks.location') }}</span>
                <input
                  class="f__input"
                  type="text"
                  maxlength="200"
                  :value="link.location ?? ''"
                  :placeholder="t('adminUploadLinks.locationPlaceholder')"
                  @change="patchLink(link, { location: String(($event.target as HTMLInputElement).value).trim() || null })"
                >
              </label>
            </div>

            <div class="grp grp--three">
              <span class="grp__head">{{ t('adminUploadLinks.groupLimits') }}</span>
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
                <span class="f__label">{{ t('adminUploadLinks.perTotal') }}</span>
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
          </div>
        </div>
      </li>
    </ul>

    <p v-else class="eul__empty">{{ t('adminUploadLinks.none') }}</p>

    <!-- Warning, not just a confirmation: this takes the submissions with it,
         and it names what is about to go so the number is seen before the tap. -->
    <UiModal
      :model-value="!!confirmTarget"
      :title="t('adminUploadLinks.deleteTitle')"
      @update:model-value="v => { if (!v) confirmTarget = null }"
    >
      <p class="confirm-text">
        <i18n-t keypath="adminUploadLinks.deleteWarnBody" tag="span" scope="global">
          <template #label><strong>{{ confirmTarget?.label }}</strong></template>
        </i18n-t>
      </p>
      <ul class="confirm-list">
        <li v-if="confirmTarget && confirmTarget.photoCount > 0">
          {{ t('adminUploadLinks.deleteWarnPhotos', { count: confirmTarget.photoCount }) }}
        </li>
        <li v-else>{{ t('adminUploadLinks.deleteWarnNoPhotos') }}</li>
        <li v-if="confirmTarget && confirmTarget.contributorCount > 0">
          {{ t('adminUploadLinks.deleteWarnPeople', { count: confirmTarget.contributorCount }) }}
        </li>
        <li>{{ t('adminUploadLinks.deleteWarnLink') }}</li>
      </ul>
      <p v-if="confirmTarget && confirmTarget.photoCount > 0" class="confirm-note">
        {{ t('adminUploadLinks.deleteWarnFiles') }}
      </p>
      <div class="form-actions form-actions--confirm">
        <UiButton variant="secondary" @click="confirmTarget = null">{{ t('admin.cancel') }}</UiButton>
        <UiButton variant="danger" :loading="busy" @click="deleteLink">{{ t('admin.delete') }}</UiButton>
      </div>
    </UiModal>
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
.eul__notice {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--muted);
  border-left: 2px solid var(--accent);
  padding-left: 0.6rem;
  margin-bottom: 0.75rem;
}
.eul__error {
  border-left: 2px solid var(--accent);
  padding: 0.5rem 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  color: var(--dark);
  background: #fff;
}
.eul__empty { font-family: var(--font-sans); font-size: 0.82rem; color: var(--muted); }

.eul__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 1.4rem; }
/* No card chrome. A hairline and the page ground do the separating, the way
   the album cards do it — a box per row turned the list into a stack of
   competing frames, none of which was the collection itself. */
.row { border-top: 1px solid var(--subtle); padding-top: 1.1rem; min-width: 0; }
.row__card {
  display: grid;
  grid-template-columns: 168px minmax(0, 1fr) auto;
  gap: 1.2rem 1.5rem;
  align-items: start;
}
.row__cover { min-width: 0; }
.row__img {
  display: block;
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  background: var(--subtle);
}
.row__cover-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 4 / 3;
  background: var(--subtle);
}
.row__cover-label {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}

.row__body { display: flex; flex-direction: column; gap: 0.45rem; min-width: 0; }
.row__meta {
  font-family: var(--font-sans);
  font-size: 0.56rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  margin: 0;
}
.row__meta--empty { color: var(--muted); }
.row__label {
  font-family: var(--font-serif);
  font-size: 1.28rem;
  font-weight: 400;
  line-height: 1.15;
  color: var(--dark);
  margin: 0;
}

.row__url { display: flex; align-items: center; gap: 0.5rem; min-width: 0; }
.row__code {
  flex: 1 1 auto;
  min-width: 0;
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.32rem 0.5rem;
  font-family: var(--font-latin-sans);
  font-size: 0.68rem;
  color: var(--dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* Square and adjacent, so copying is one constant target and the URL keeps the
   rest of the width — same chip as the albums index. */
.icon-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  flex-shrink: 0;
  border: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  padding: 0;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.icon-chip:hover { border-color: #4d5fb8; color: #4d5fb8; background: color-mix(in srgb, #4d5fb8 6%, transparent); }
.icon-chip:active { transform: translateY(1px); }
.icon-chip.is-copied { border-color: #4d5fb8; color: #4d5fb8; background: color-mix(in srgb, #4d5fb8 14%, transparent); }
.icon-chip__icon { width: 0.85rem; height: 0.85rem; }

.row__actions { display: flex; align-items: center; gap: 1.15rem; flex-wrap: wrap; margin-top: 0.25rem; }
.link {
  font-family: var(--font-sans);
  font-size: 0.7rem;
  letter-spacing: 0.05em;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: var(--dark);
  text-decoration: none;
  transition: color 0.2s;
}
.link:hover { color: var(--accent); }
.link:disabled { opacity: 0.45; cursor: default; }
/* The quietest of the four on purpose: it is the only one that cannot be undone. */
.link--del { color: var(--muted); }

.row__state {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  text-align: right;
  gap: 0.85rem;
  white-space: nowrap;
}
.row__pill {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  line-height: 1;
  text-transform: uppercase;
  border: 1px solid currentColor;
  padding: 0.36rem 0.56rem;
}
.row__pill--open { color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--body-bg)); }
.row__pill--closed { color: #b0243c; background: color-mix(in srgb, #b0243c 10%, var(--body-bg)); }
.row__figures { display: flex; gap: 1.5rem; }
.row__figure { display: flex; flex-direction: column; gap: 0.25rem; }
.row__num {
  font-family: var(--font-sans);
  font-size: 1.35rem;
  font-weight: 300;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--dark);
}
/* A zero in --subtle rather than --muted: an empty collection should read as
   empty without stopping to parse the digit. */
.row__num--zero { color: var(--subtle); }
.row__figure-label {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
/* Settings panel. Three spacing steps, used consistently: --gap-tight inside a
   field, --gap-field between fields in a group, --gap-group between groups.
   The old panel used one 0.6rem gap for all three, which is why nine unrelated
   controls read as a single wall. */
.row__edit {
  --gap-tight: 0.3rem;
  --gap-field: 0.9rem;
  --gap-group: 1.85rem;

  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: var(--gap-group);
  margin-top: 1.3rem;
  padding-top: 1.2rem;
  border-top: 1px solid var(--subtle);
}

.edit__cover { display: flex; flex-direction: column; gap: var(--gap-tight); }
.edit__groups { display: flex; flex-direction: column; gap: var(--gap-group); }

.grp {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--gap-field);
  align-items: end;
}
.grp--three { grid-template-columns: repeat(3, minmax(0, 1fr)); }

/* The group's name carries the hairline, so the rule doubles as the separator
   and the panel needs no boxes to show its structure. */
.grp__head {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}
.grp__head::after { content: ''; flex: 1; height: 1px; background: var(--subtle); }

@media (max-width: 860px) {
  .row__edit { grid-template-columns: 1fr; gap: var(--gap-group); }
  .edit__cover { max-width: 240px; }
  .grp, .grp--three { grid-template-columns: 1fr; }
}

.eul__create {
  display: grid;
  grid-template-columns: 2fr 2fr 1fr 2fr auto;
  gap: 0.6rem;
  align-items: end;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--subtle);
}
.f { display: flex; flex-direction: column; gap: var(--gap-tight, 0.3rem); }
.f--check { flex-direction: row; align-items: center; gap: 0.4rem; }
/* The cover preview is far taller than a text input — give it the full row so
   it does not stretch the whole auto-fit grid to its height. */
/* .f--cover retired: the cover has its own column now (.edit__cover). */
.f__hint {
  font-family: var(--font-sans);
  font-size: 0.68rem;
  color: var(--muted);
  line-height: 1.5;
}
.f__label {
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.f__input {
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.4rem 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  color: var(--dark);
}
.f__input:focus { outline: none; border-color: var(--accent); }

.btn {
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.32rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
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
/* Dialog body. Not scoped away into the shared modal styles because the
   wording is specific to what a collection takes down with it. */
.confirm-text { font-size: 0.9rem; line-height: 1.6; color: var(--dark); }
.confirm-text strong { font-weight: 500; }
.confirm-list {
  list-style: none;
  margin: 0.85rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.84rem;
  color: var(--muted);
}
.confirm-list li { padding-left: 0.9rem; position: relative; }
.confirm-list li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.62em;
  width: 4px;
  height: 1px;
  background: var(--accent);
}
.confirm-note {
  margin-top: 0.9rem;
  padding-left: 0.75rem;
  border-left: 2px solid var(--subtle);
  font-size: 0.78rem;
  line-height: 1.55;
  color: var(--muted);
}
.form-actions--confirm { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.4rem; }

.btn--primary { border-color: var(--dark); }
/* The create button sits in a grid row with label+input columns; without this
   its smaller height leaves it floating above the inputs' shared bottom line. */
.eul__create .btn--primary {
  align-self: end;
  padding: 0.62rem 1.1rem;
}

@media (max-width: 820px) {
  .eul__create { grid-template-columns: 1fr; }
}
/* Below this the three columns stop fitting side by side; the state column
   loses its right edge to align with everything else. */
@media (max-width: 720px) {
  .row__card { grid-template-columns: 1fr; }
  .row__state { align-items: flex-start; text-align: left; }
}
</style>
