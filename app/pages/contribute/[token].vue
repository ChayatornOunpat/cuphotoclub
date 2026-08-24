<script setup lang="ts">
// Participant upload page. Deliberately shaped like dropping files into Google
// Drive: the dropzone is the page, and everything else sits at the edges.
// There are no settings here — caps, compression and the byte ceiling are all
// decided by the admin on the link (see docs/event-photo-submissions.md).
definePageMeta({ layout: 'site' })

const { t } = useI18n()
const route = useRoute()
const token = computed(() => String(route.params.token || ''))

interface LinkState {
  link: {
    label: string | null
    open: boolean
    requireName: boolean
    maxPerContributor: number
    compress: boolean
    compressMaxDim: number
    compressQuality: number
    maxBytesPerPhoto: number
    expiresAt: string | null
  }
  event: { title: string, slug: string, eventDate: string | null } | null
  me: {
    displayName: string | null
    contact: string | null
    code: string | null
    used: number
    remaining: number
  } | null
}

interface MineItem {
  id: string
  caption: string | null
  size: number
  type: string
  createdAt: string
  publishedTo: string | null
  previewUrl: string
}

const api = computed(() => `/api/contribute/${encodeURIComponent(token.value)}`)

const { data: state, refresh: refreshState } = await useFetch<LinkState>(api, {
  key: () => `contribute-${token.value}`
})

if (!state.value) {
  throw createError({ statusCode: 404, statusMessage: 'Upload link not found', fatal: true })
}

// useFetch sets `data` back to undefined when a refresh fails, and a refresh
// runs after every save. Holding the last good payload keeps a network blip
// from blanking a page someone is in the middle of using.
const lastGood = ref<LinkState>(state.value)
watch(state, (value) => { if (value) lastGood.value = value })
const view = computed<LinkState>(() => state.value ?? lastGood.value)

const mine = ref<MineItem[]>([])
const loadingMine = ref(false)

async function refreshMine() {
  loadingMine.value = true
  try {
    const result = await $fetch<{ open: boolean, items: MineItem[] }>(`${api.value}/mine`)
    mine.value = result.items
  } catch {
    mine.value = []
  } finally {
    loadingMine.value = false
  }
}

onMounted(() => {
  if (state.value?.me) refreshMine()
})

const link = computed(() => view.value.link)
const me = computed(() => view.value.me)
const open = computed(() => link.value.open)
const used = computed(() => me.value?.used ?? 0)
const remaining = computed(() => me.value?.remaining ?? link.value.maxPerContributor)
const atLimit = computed(() => Boolean(me.value) && remaining.value <= 0)

// ── Name / credit ───────────────────────────────────────────────────────────
const nameInput = ref('')
const contactInput = ref('')
const savingName = ref(false)
const nameSaved = ref(false)
// Seed the fields from the server once per identity. A plain watchEffect on
// `me` re-ran after every refresh and overwrote whatever was half-typed.
const seededFor = ref('')
watch(me, (value) => {
  const key = value ? `${value.displayName ?? ''}|${value.contact ?? ''}` : ''
  if (!value || seededFor.value) return
  seededFor.value = key || 'seeded'
  nameInput.value = value.displayName ?? ''
  contactInput.value = value.contact ?? ''
}, { immediate: true })

async function saveName() {
  if (!open.value || savingName.value) return
  savingName.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/me`, {
      method: 'PATCH',
      body: { displayName: nameInput.value, contact: contactInput.value }
    })
    await refreshState()
    nameSaved.value = true
    setTimeout(() => { nameSaved.value = false }, 1800)
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.saveFailed'))
  } finally {
    savingName.value = false
  }
}

// ── Claim code ──────────────────────────────────────────────────────────────
const codeCopied = ref(false)
async function copyCode() {
  if (!me.value?.code) return
  try {
    await navigator.clipboard.writeText(me.value.code)
    codeCopied.value = true
    setTimeout(() => { codeCopied.value = false }, 1600)
  } catch {
    // Clipboard blocked (insecure context, permissions) — the code is on screen
    // to read anyway, so this is not worth an error message.
  }
}

const showCodeEntry = ref(false)
const codeInput = ref('')
const claiming = ref(false)
async function claimCode() {
  if (claiming.value || !codeInput.value.trim()) return
  claiming.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/claim`, { method: 'POST', body: { code: codeInput.value } })
    codeInput.value = ''
    showCodeEntry.value = false
    await refreshState()
    await refreshMine()
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.codeNotFound'))
  } finally {
    claiming.value = false
  }
}

// ── Uploads ─────────────────────────────────────────────────────────────────
const errorMessage = ref('')
const uploadedKeys = ref<string[]>([])

function apiMessage(err: unknown, fallback: string) {
  const data = (err as { data?: { message?: string } })?.data
  return data?.message || fallback
}

// The uploader manages its own progress; once a batch lands we re-read both the
// counts and the grid so "34 of 100" and the thumbnails agree.
async function onUploaded() {
  await Promise.all([refreshState(), refreshMine()])
}

// ── Per-photo edit / remove ─────────────────────────────────────────────────
const editingId = ref('')
const captionDraft = ref('')
const busyId = ref('')

function startEdit(item: MineItem) {
  editingId.value = item.id
  captionDraft.value = item.caption ?? ''
}

async function saveCaption(item: MineItem) {
  busyId.value = item.id
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/mine/${item.id}`, {
      method: 'PATCH',
      body: { caption: captionDraft.value }
    })
    item.caption = captionDraft.value.trim() || null
    editingId.value = ''
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.saveFailed'))
  } finally {
    busyId.value = ''
  }
}

const confirmRemoveId = ref('')

async function removePhoto(item: MineItem) {
  busyId.value = item.id
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/mine/${item.id}`, { method: 'DELETE' })
    mine.value = mine.value.filter(row => row.id !== item.id)
    confirmRemoveId.value = ''
    await refreshState()
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.removeFailed'))
  } finally {
    busyId.value = ''
  }
}

const heading = computed(() => state.value?.event?.title || link.value.label || t('contribute.title'))

useSeoMeta({
  title: () => t('contribute.title'),
  // An upload link is not something to index or preview socially.
  robots: 'noindex, nofollow'
})
</script>

<template>
  <div class="contrib">
    <header class="contrib__head">
      <p class="contrib__eyebrow">{{ t('contribute.eyebrow') }}</p>
      <h1 class="contrib__title">{{ heading }}</h1>
      <p v-if="open" class="contrib__lead">{{ t('contribute.lead') }}</p>
      <p v-else class="contrib__closed">{{ t('contribute.closed') }}</p>
    </header>

    <p v-if="errorMessage" class="contrib__error">{{ errorMessage }}</p>

    <!-- Drop first, ask questions later. -->
    <section v-if="open" class="contrib__drop">
      <AdminR2ImageUploader
        v-if="!atLimit"
        v-model="uploadedKeys"
        :endpoint-base="`${api}/sessions`"
        :remember-signatures="false"
        :handoff-to-dock="false"
        :compress="link.compress"
        :compress-max-dim="link.compressMaxDim"
        :compress-quality="link.compressQuality"
        :show-compress-control="false"
        :max-bytes="link.maxBytesPerPhoto"
        :show-previews="false"
        :max-files="remaining"
        @uploaded="onUploaded"
      />
      <p v-if="atLimit" class="contrib__limit">
        {{ t('contribute.limitNotice', { max: link.maxPerContributor }) }}
      </p>
      <p class="contrib__counter" :class="{ 'is-full': atLimit }">
        {{ t('contribute.counter', { used, max: link.maxPerContributor }) }}
        <span v-if="atLimit"> · {{ t('contribute.limitReached') }}</span>
      </p>
    </section>

    <!-- Credit. One optional field; blank means anonymous. -->
    <section v-if="open" class="contrib__credit">
      <div class="field">
        <label class="field__label" for="contrib-name">
          {{ link.requireName ? t('contribute.nameRequired') : t('contribute.nameOptional') }}
        </label>
        <input
          id="contrib-name"
          v-model="nameInput"
          class="field__input"
          type="text"
          maxlength="120"
          :placeholder="t('contribute.namePlaceholder')"
          @blur="saveName"
        >
      </div>
      <div class="field">
        <label class="field__label" for="contrib-contact">{{ t('contribute.contactOptional') }}</label>
        <input
          id="contrib-contact"
          v-model="contactInput"
          class="field__input"
          type="text"
          maxlength="200"
          :placeholder="t('contribute.contactPlaceholder')"
          @blur="saveName"
        >
      </div>
      <p class="contrib__credit-note">
        <span v-if="nameSaved" class="contrib__saved">{{ t('contribute.saved') }}</span>
        <span v-else>{{ t('contribute.creditNote') }}</span>
      </p>
    </section>

    <!-- Claim code: a quiet strip, never a gate. -->
    <section v-if="me?.code" class="contrib__code">
      <span class="contrib__code-label">{{ t('contribute.codeLabel') }}</span>
      <code class="contrib__code-value">{{ me.code }}</code>
      <button type="button" class="contrib__code-copy" @click="copyCode">
        {{ codeCopied ? t('contribute.copied') : t('contribute.copy') }}
      </button>
      <span class="contrib__code-hint">{{ t('contribute.codeHint') }}</span>
    </section>

    <section v-else class="contrib__code contrib__code--entry">
      <button v-if="!showCodeEntry" type="button" class="contrib__link-btn" @click="showCodeEntry = true">
        {{ t('contribute.haveCode') }}
      </button>
      <template v-else>
        <input
          v-model="codeInput"
          class="field__input contrib__code-input"
          :aria-label="t('contribute.codePlaceholder')"
          type="text"
          autocapitalize="characters"
          spellcheck="false"
          :placeholder="t('contribute.codePlaceholder')"
          @keyup.enter="claimCode"
        >
        <button type="button" class="contrib__code-copy" :disabled="claiming" @click="claimCode">
          {{ claiming ? t('contribute.checking') : t('contribute.useCode') }}
        </button>
      </template>
    </section>

    <!-- Their photos. This grid is the confirmation that it worked. -->
    <section v-if="mine.length" class="contrib__mine">
      <h2 class="contrib__mine-title">{{ t('contribute.yourPhotos', { count: mine.length }) }}</h2>
      <ul class="grid">
        <li v-for="item in mine" :key="item.id" class="tile">
          <img class="tile__img" :src="item.previewUrl" alt="" loading="lazy">

          <div v-if="editingId === item.id" class="tile__edit">
            <input
              v-model="captionDraft"
              class="field__input"
              :aria-label="t('contribute.captionPlaceholder')"
              type="text"
              maxlength="500"
              :placeholder="t('contribute.captionPlaceholder')"
              @keyup.enter="saveCaption(item)"
            >
            <div class="tile__edit-actions">
              <button type="button" class="tile__btn" :disabled="busyId === item.id" @click="saveCaption(item)">
                {{ t('contribute.save') }}
              </button>
              <button type="button" class="tile__btn" @click="editingId = ''">{{ t('contribute.cancel') }}</button>
            </div>
          </div>

          <div v-else class="tile__foot">
            <p class="tile__caption">{{ item.caption || t('contribute.noCaption') }}</p>
            <div v-if="open" class="tile__actions">
              <button type="button" class="tile__btn" @click="startEdit(item)">{{ t('contribute.edit') }}</button>
              <button
                v-if="confirmRemoveId !== item.id"
                type="button"
                class="tile__btn tile__btn--danger"
                @click="confirmRemoveId = item.id"
              >{{ t('contribute.remove') }}</button>
              <template v-else>
                <button
                  type="button"
                  class="tile__btn tile__btn--danger"
                  :disabled="busyId === item.id"
                  @click="removePhoto(item)"
                >{{ t('contribute.confirmRemove') }}</button>
                <button type="button" class="tile__btn" @click="confirmRemoveId = ''">{{ t('contribute.cancel') }}</button>
              </template>
            </div>
          </div>
        </li>
      </ul>
    </section>

    <p v-else-if="me && !loadingMine" class="contrib__empty">{{ t('contribute.empty') }}</p>
  </div>
</template>

<style scoped>
.contrib {
  max-width: 980px;
  margin: 0 auto;
  padding: 5rem 1.5rem 6rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.contrib__head { display: flex; flex-direction: column; gap: 0.6rem; }
.contrib__eyebrow {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--accent);
}
.contrib__title {
  font-family: var(--font-serif);
  font-size: clamp(1.9rem, 4vw, 3rem);
  line-height: 1.08;
  color: var(--dark);
}
.contrib__lead,
.contrib__closed {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.6;
  color: var(--muted);
  max-width: 52ch;
}
.contrib__closed { color: var(--dark); }

.contrib__error {
  border-left: 2px solid var(--accent);
  padding: 0.6rem 0.9rem;
  background: var(--paper);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  color: var(--dark);
}

.contrib__drop { display: flex; flex-direction: column; gap: 0.6rem; }
.contrib__counter {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.contrib__counter.is-full { color: var(--accent); }
.contrib__limit {
  border: 1px dashed var(--accent);
  padding: 0.7rem 0.9rem;
  font-family: var(--font-serif);
  font-size: 0.92rem;
  color: var(--dark);
}

/* ── Credit ── */
.contrib__credit {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem 1.25rem;
  padding: 1.25rem;
  border: 1px solid var(--subtle);
  background: var(--paper);
}
.field { display: flex; flex-direction: column; gap: 0.35rem; }
.field__label {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.field__input {
  width: 100%;
  border: 1px solid var(--subtle);
  background: #fff;
  padding: 0.55rem 0.7rem;
  font-family: var(--font-serif);
  font-size: 0.92rem;
  color: var(--dark);
}
.field__input:focus { outline: none; border-color: var(--accent); }
.contrib__credit-note {
  grid-column: 1 / -1;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  color: var(--muted);
}
.contrib__saved { color: var(--accent); }

/* ── Claim code ── */
.contrib__code {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.6rem;
  padding: 0.7rem 0.9rem;
  border: 1px dashed var(--subtle);
}
.contrib__code-label {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
}
.contrib__code-value {
  font-family: var(--font-latin-sans);
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  color: var(--dark);
}
.contrib__code-copy,
.contrib__link-btn {
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.3rem 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.contrib__code-copy:hover,
.contrib__link-btn:hover { border-color: var(--accent); color: var(--accent); }
.contrib__code-copy:disabled { opacity: 0.5; cursor: default; }
.contrib__code-hint {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  color: var(--muted);
}
.contrib__code--entry { border-style: solid; }
.contrib__code-input { max-width: 16rem; letter-spacing: 0.12em; }

/* ── Their photos ── */
.contrib__mine { display: flex; flex-direction: column; gap: 0.9rem; }
.contrib__mine-title {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
}
.grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}
.tile {
  border: 1px solid var(--subtle);
  background: var(--paper);
  display: flex;
  flex-direction: column;
}
.tile__img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  background: var(--subtle);
}
.tile__foot,
.tile__edit { padding: 0.55rem 0.6rem; display: flex; flex-direction: column; gap: 0.45rem; }
.tile__caption {
  font-family: var(--font-serif);
  font-size: 0.82rem;
  color: var(--dark);
  overflow-wrap: anywhere;
}
.tile__actions,
.tile__edit-actions { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.tile__btn {
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.22rem 0.5rem;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dark);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.tile__btn:hover { border-color: var(--accent); color: var(--accent); }
.tile__btn:disabled { opacity: 0.5; cursor: default; }
.tile__btn--danger:hover { border-color: var(--accent); color: var(--accent); }

.contrib__empty {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--muted);
}

@media (max-width: 640px) {
  .contrib { padding: 3.5rem 1.1rem 4rem; }
  .contrib__credit { grid-template-columns: 1fr; }
}
</style>
