<script setup lang="ts">
// Participant upload page. Three stages rather than one flat form:
//
//   1. welcome  — what this collection is, and what a claim code is for.
//                 A browser that already holds an identity gets `resume`
//                 instead: same surface, asking whether it is still them.
//   2. identity — mint a code (optionally with a name / contact / credit
//                 consent), or adopt one typed from another device.
//   3. upload   — the working screen: sticky counter, dropzone, photo grid.
//
// Everything about the upload itself (presign → PUT → complete, compression,
// retries, the pending queue) still lives in R2ImageUploader; this page only
// decides composition, chrome and state. Caps, compression and the byte ceiling
// are the admin's, set on the link (see docs/event-photo-submissions.md).
//
// The layout is `contribute`, not `site`: no nav, no footer nav columns. See
// app/layouts/contribute.vue for why.
definePageMeta({ layout: 'contribute' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const token = computed(() => String(route.params.token || ''))

interface LinkState {
  link: {
    label: string | null
    description: string | null
    coverKey: string | null
    eventDate: string | null
    location: string | null
    open: boolean
    requireName: boolean
    maxPerContributor: number
    compress: boolean
    compressMaxDim: number
    compressQuality: number
    maxBytesPerPhoto: number
    expiresAt: string | null
  }
  me: {
    displayName: string | null
    contact: string | null
    creditHandle: boolean
    note: string | null
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

const { data: state, error: stateError, refresh: refreshState } = await useFetch<LinkState>(api, {
  key: () => `contribute-${token.value}`
})

// useFetch sets `data` back to undefined when a refresh fails, and a refresh
// runs after every save. Holding the last good payload keeps a network blip
// from blanking a page someone is in the middle of using.
const lastGood = ref<LinkState | null>(state.value ?? null)
watch(state, (value) => { if (value) lastGood.value = value })

// A deleted collection and a mistyped token are indistinguishable to the server,
// so the page owns this state in its own words rather than throwing a fatal 404
// into the site-wide error page — which offers "back to home", useless to
// someone standing in a venue holding a QR code.
const notFound = computed(() => !state.value && !lastGood.value)
if (import.meta.server && !state.value) {
  const event = useRequestEvent()
  if (event) setResponseStatus(event, 404)
}

// Shape-complete stand-in so every computed below can stay unguarded. Only ever
// read while the not-found branch is what actually renders.
const EMPTY: LinkState = {
  link: {
    label: null, description: null, coverKey: null, eventDate: null, location: null,
    open: false, requireName: false, maxPerContributor: 0,
    compress: true, compressMaxDim: 3040, compressQuality: 85,
    maxBytesPerPhoto: 0, expiresAt: null
  },
  me: null
}
const view = computed<LinkState>(() => state.value ?? lastGood.value ?? EMPTY)

const link = computed(() => view.value.link)
const me = computed(() => view.value.me)
const open = computed(() => link.value.open)
const used = computed(() => me.value?.used ?? 0)
const remaining = computed(() => me.value?.remaining ?? link.value.maxPerContributor)
const atLimit = computed(() => Boolean(me.value) && remaining.value <= 0)
const meterRatio = computed(() => {
  const max = link.value.maxPerContributor || 1
  return Math.min(1, used.value / max)
})

// ── Stage machine ───────────────────────────────────────────────────────────
type Stage = 'welcome' | 'resume' | 'create' | 'issued' | 'claim' | 'upload'
// A browser that already holds an identity is asked to confirm it before the
// working screen opens, rather than being dropped into someone else's batch.
// These links are opened at the venue on whatever phone is nearest, so the
// cookie routinely outlives the person who made it — and the only visible
// consequence of getting it wrong is a wall of photos that are not yours, with
// a delete button on every one. The welcome is still for a genuine first visit.
const stage = ref<Stage>(me.value ? 'resume' : 'welcome')

const errorMessage = ref('')
function apiMessage(err: unknown, fallback: string) {
  const data = (err as { data?: { message?: string } })?.data
  return data?.message || fallback
}

// ── Toasts ──────────────────────────────────────────────────────────────────
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2600)
}

// ── Clipboard ───────────────────────────────────────────────────────────────
// navigator.clipboard does not exist on a non-secure origin, and this page is
// opened over venue wifi more than anywhere else on the site. Fall back to the
// old offscreen-selection trick before admitting defeat.
async function writeClipboard(text: string) {
  try {
    if (window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Blocked or denied — the fallback below may still work.
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.top = '-1000px'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

async function copyCode() {
  const code = me.value?.code
  if (!code) return
  const ok = await writeClipboard(code)
  showToast(ok ? t('contribute.codeCopied') : t('contribute.copyFailed'))
}

// ── Their photos ────────────────────────────────────────────────────────────
const mine = ref<MineItem[]>([])
const loadingMine = ref(false)
const selectedIds = ref<string[]>([])

async function refreshMine() {
  loadingMine.value = true
  try {
    const result = await $fetch<{ open: boolean, items: MineItem[] }>(`${api.value}/mine`)
    mine.value = result.items
    // Drop selections whose photo is gone, or "3 selected" outlives the photos.
    const alive = new Set(result.items.map(item => item.id))
    selectedIds.value = selectedIds.value.filter(id => alive.has(id))
  } catch {
    mine.value = []
    selectedIds.value = []
  } finally {
    loadingMine.value = false
  }
}

onMounted(() => { if (me.value) refreshMine() })

// ── Identity fields ─────────────────────────────────────────────────────────
const nameInput = ref('')
const contactInput = ref('')
const creditHandle = ref(false)
const noteInput = ref('')
const creating = ref(false)

// Seed the fields from the server once per identity. A plain watchEffect on
// `me` re-ran after every refresh and overwrote whatever was half-typed.
const seeded = ref(false)
watch(me, (value) => {
  if (!value || seeded.value) return
  seeded.value = true
  nameInput.value = value.displayName ?? ''
  contactInput.value = value.contact ?? ''
  creditHandle.value = Boolean(value.creditHandle)
  noteInput.value = value.note ?? ''
}, { immediate: true })

async function createCode() {
  if (creating.value) return
  creating.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/me`, {
      method: 'PATCH',
      body: {
        displayName: nameInput.value,
        contact: contactInput.value,
        creditHandle: creditHandle.value
      }
    })
    await refreshState()
    // No plaintext code means this browser adopted an identity rather than
    // minting one; there is nothing to show, so go straight to work.
    stage.value = me.value?.code ? 'issued' : 'upload'
    await refreshMine()
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.saveFailed'))
  } finally {
    creating.value = false
  }
}

// ── Adopt a code ────────────────────────────────────────────────────────────
const codeInput = ref('')
const claiming = ref(false)
const claimError = ref('')

// Format as they type, so a code pasted out of a screenshot, a chat message or
// a notes app lands in the CUPC-XXXXX-XXXXX shape. "CUPC" can never begin a real
// code body — U is not in the Crockford alphabet the codes are drawn from — so
// stripping a leading prefix is unambiguous, and treating a *partial* prefix as
// literal is what keeps backspace from re-inserting the text being deleted.
function formatCodeInput(raw: string) {
  const cleaned = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (!cleaned) return ''
  if ('CUPC'.startsWith(cleaned)) return cleaned
  const body = cleaned.startsWith('CUPC') ? cleaned.slice(4) : cleaned
  const parts = ['CUPC', body.slice(0, 5)]
  if (body.length > 5) parts.push(body.slice(5, 10))
  return parts.join('-')
}

function onCodeInput(event: Event) {
  const el = event.target as HTMLInputElement
  const formatted = formatCodeInput(el.value)
  codeInput.value = formatted
  el.value = formatted
}

async function claimCode() {
  if (claiming.value || !codeInput.value.trim()) return
  claiming.value = true
  claimError.value = ''
  try {
    await $fetch(`${api.value}/claim`, { method: 'POST', body: { code: codeInput.value } })
    codeInput.value = ''
    seeded.value = false
    await refreshState()
    await refreshMine()
    stage.value = 'upload'
  } catch (err) {
    claimError.value = apiMessage(err, t('contribute.claimFailed'))
  } finally {
    claiming.value = false
  }
}

// ── Uploads ─────────────────────────────────────────────────────────────────
// The uploader manages its own progress; once a batch lands we re-read both the
// counts and the grid so "34 of 100" and the thumbnails agree.
const uploadedKeys = ref<string[]>([])
async function onUploaded() {
  await Promise.all([refreshState(), refreshMine()])
}

// ── Returning visitor ───────────────────────────────────────────────────────
// The cookie says who this browser is; only the person holding it knows whether
// that is still true.
const resumeName = computed(() => me.value?.displayName?.trim() || '')

function continueAsMe() {
  stage.value = 'upload'
  refreshMine()
}

const switching = ref(false)

// "Not me" drops this browser's cookie entry and nothing else: the previous
// contributor keeps their row, their photos and their code, and can walk back in
// on any device by typing it. Which is also why the screen above this shows the
// code one last time — the plaintext lives in the cookie being dropped.
//
// Back to `welcome`, not straight to `create`: the next person may be new, or
// may be arriving with a code of their own, and the welcome already offers both.
async function useAnotherIdentity() {
  if (switching.value) return
  switching.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/me`, { method: 'DELETE' })
    // Everything the old identity left behind goes with it, or the next person
    // finds someone else's name pre-filled and someone else's photos on screen.
    mine.value = []
    selectedIds.value = []
    uploadedKeys.value = []
    seeded.value = false
    nameInput.value = ''
    contactInput.value = ''
    creditHandle.value = false
    noteInput.value = ''
    await refreshState()
    stage.value = 'welcome'
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.switchFailed'))
  } finally {
    switching.value = false
  }
}

// ── Selection ───────────────────────────────────────────────────────────────
const selectionCount = computed(() => selectedIds.value.length)

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}
function toggleSelect(id: string) {
  selectedIds.value = isSelected(id)
    ? selectedIds.value.filter(row => row !== id)
    : [...selectedIds.value, id]
}
function selectAll() {
  selectedIds.value = mine.value.map(item => item.id)
}
function clearSelection() {
  selectedIds.value = []
}

// ── Removal ─────────────────────────────────────────────────────────────────
const removing = ref(false)
// Confirmation is a dialog, never a second inline button: on a phone the second
// tap of an accidental double-tap would land on "yes" and the batch is gone.
const confirmOpen = ref(false)
const cancelButton = ref<HTMLButtonElement | null>(null)
watch(confirmOpen, (value) => {
  if (value) nextTick(() => cancelButton.value?.focus())
})

async function deleteOne(id: string) {
  await $fetch(`${api.value}/mine/${id}`, { method: 'DELETE' })
  mine.value = mine.value.filter(row => row.id !== id)
  selectedIds.value = selectedIds.value.filter(row => row !== id)
}

// The × on a tile removes that one photo straight away. One tap, one photo, and
// it is the photo under their finger — there is nothing to confirm.
async function removeOne(item: MineItem) {
  if (removing.value || !open.value) return
  removing.value = true
  errorMessage.value = ''
  try {
    await deleteOne(item.id)
    await refreshState()
    showToast(t('contribute.removedOne'))
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.removeFailed'))
  } finally {
    removing.value = false
  }
}

async function removeSelected() {
  if (removing.value) return
  removing.value = true
  errorMessage.value = ''
  const count = selectedIds.value.length
  try {
    for (const id of [...selectedIds.value]) await deleteOne(id)
    confirmOpen.value = false
    await refreshState()
    showToast(count === 1 ? t('contribute.removedOne') : t('contribute.removedMany', { count }))
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.removeFailed'))
  } finally {
    removing.value = false
  }
}

// ── Full-size viewer ────────────────────────────────────────────────────────
const viewerId = ref('')
const viewerItem = computed(() => mine.value.find(item => item.id === viewerId.value) ?? null)
function openViewer(item: MineItem) { viewerId.value = item.id }
function closeViewer() { viewerId.value = '' }

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && viewerId.value) closeViewer()
}

// ── Note ────────────────────────────────────────────────────────────────────
const noteSaved = ref(false)
const savingNote = ref(false)
let noteFlashTimer: ReturnType<typeof setTimeout> | null = null

// Saves on blur with a flash, matching how the name field has always behaved. A
// submit button here would read as "send my photos", which it is not.
async function saveNote() {
  if (!open.value || savingNote.value) return
  if ((noteInput.value.trim() || null) === (me.value?.note ?? null)) return
  savingNote.value = true
  errorMessage.value = ''
  try {
    await $fetch(`${api.value}/me`, { method: 'PATCH', body: { note: noteInput.value } })
    await refreshState()
    noteSaved.value = true
    if (noteFlashTimer) clearTimeout(noteFlashTimer)
    noteFlashTimer = setTimeout(() => { noteSaved.value = false }, 1800)
  } catch (err) {
    errorMessage.value = apiMessage(err, t('contribute.saveFailed'))
  } finally {
    savingNote.value = false
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (toastTimer) clearTimeout(toastTimer)
  if (noteFlashTimer) clearTimeout(noteFlashTimer)
})

// ── Header presentation ─────────────────────────────────────────────────────
const heading = computed(() => link.value.label || t('contribute.title'))
const description = computed(() => link.value.description || '')

// Collections are standalone, so there is no event to inherit a cover from —
// most links will not have one. With a cover the header sits on the photo; with
// none it sits on a gradient built from the club's own accent, which is a
// deliberate treatment rather than a placeholder for a missing image.
const coverSrc = computed(() => {
  const key = link.value.coverKey?.trim()
  return key ? `/images/${key.replace(/^\/+/, '')}` : ''
})

// Date and place, when the admin filled them in. formatDate is the site's one
// date formatter (app/utils/format.ts) — same dd/mm/yy the albums use, read in
// UTC so a date stored as midnight UTC keeps its day everywhere.
const eventDateText = computed(() => {
  const raw = link.value.eventDate
  return raw ? formatDate(raw) : ''
})
const metaParts = computed(() => [eventDateText.value, link.value.location || ''].filter(Boolean))

// The welcome and the returning-visitor screen share one surface, so they share
// its header too — but they are asking different things. The welcome introduces
// a collection, and leads with its name. `resume` asks one question, leads with
// that, and demotes the collection name to the meta line where it still answers
// "which link is this?" without competing with the question.
const headingText = computed(() => (
  stage.value === 'resume' ? t('contribute.resumeTitle') : heading.value
))
const metaLine = computed(() => (
  stage.value === 'resume' ? [heading.value, ...metaParts.value] : metaParts.value
))

useSeoMeta({
  title: () => t('contribute.title'),
  // An upload link is not something to index or preview socially.
  robots: 'noindex, nofollow'
})
</script>

<template>
  <!-- ── Not found ──────────────────────────────────────────────────────── -->
  <div v-if="notFound || stateError" class="stage stage--solo">
    <div class="stage__body stage__body--narrow">
      <p class="mark"><span class="mark__cu">CU</span>PHOTOCLUB</p>
      <p class="eyebrow-line">{{ t('contribute.eyebrow') }}</p>
      <h1 class="stage__title">{{ t('contribute.notFoundTitle') }}</h1>
      <p class="stage__lead">{{ t('contribute.notFoundLead') }}</p>
      <ul class="notes">
        <li>{{ t('contribute.notFoundNote1') }}</li>
        <li>{{ t('contribute.notFoundNote2') }}</li>
      </ul>
      <div class="actions">
        <NuxtLink class="btn btn--fill" :to="localePath('/albums')">{{ t('contribute.notFoundAlbums') }}</NuxtLink>
        <NuxtLink class="btn btn--ghost" :to="localePath('/contacts')">{{ t('contribute.notFoundContact') }}</NuxtLink>
      </div>
    </div>
  </div>

  <div v-else class="contrib">
    <!-- ── Stage 1: welcome, or "is this still you?" ────────────────────── -->
    <template v-if="stage === 'welcome' || stage === 'resume'">
      <!-- One dark surface, not a banner over a paper page: the cover is the
           left half on desktop and the top band on mobile, and everything that
           follows sits on the same ground. -->
      <div class="wstage" :class="{ 'wstage--cover': coverSrc }">
        <div class="wstage__art">
          <!-- One bounded image per page load, so the transform budget applies. -->
          <AppImg
            v-if="coverSrc"
            class="wstage__cover"
            :src="coverSrc"
            :alt="heading"
            sizes="100vw md:60vw"
            eager
            optimize
          />
          <p class="mark"><span class="mark__cu">CU</span>PHOTOCLUB</p>
        </div>

        <div class="wstage__panel">
          <p class="eyebrow-line">{{ t('contribute.eyebrow') }}</p>
          <h1 class="stage__title">{{ headingText }}</h1>
          <p v-if="metaLine.length" class="stage__meta">
            <span v-for="(part, i) in metaLine" :key="`${i}-${part}`">
              <span v-if="i" class="stage__meta-sep" aria-hidden="true"> · </span>{{ part }}
            </span>
          </p>
          <p v-if="stage === 'resume'" class="stage__desc">{{ t('contribute.resumeLead') }}</p>
          <p v-else-if="description" class="stage__desc">{{ description }}</p>

          <div class="cut-line cut-line--inset" />

          <p v-if="!open" class="alert alert--dark">{{ t('contribute.closed') }}</p>

          <!-- Returning visitor: who this browser currently is, and the way out
               if that is the wrong person. -->
          <template v-if="stage === 'resume'">
            <p v-if="errorMessage" class="alert alert--dark">{{ errorMessage }}</p>

            <section class="whois">
              <h2 class="whois__title">{{ t('contribute.resumeWhoTitle') }}</h2>
              <!-- Anonymous is a real answer here, not a missing value: most
                   contributors never type a name, so it is said plainly rather
                   than left as a blank line to puzzle over. -->
              <p class="whois__name" :class="{ 'whois__name--anon': !resumeName }">
                {{ resumeName || t('contribute.resumeAnonymous') }}
              </p>
              <p class="whois__meta">{{ t('contribute.counter', { used, max: link.maxPerContributor }) }}</p>

              <!-- Their last look at the code before "not me" drops it. Absent
                   for someone who arrived by typing one — they already have it. -->
              <button
                v-if="me?.code"
                type="button"
                class="whois__code"
                :aria-label="t('contribute.copyCodeAria')"
                @click="copyCode"
              >
                <span class="whois__code-label">{{ t('contribute.codeLabel') }}</span>
                <span class="whois__code-value">{{ me.code }}</span>
              </button>
            </section>

            <div class="actions actions--answer">
              <button type="button" class="btn btn--fill" @click="continueAsMe">
                {{ t('contribute.resumeYes') }}
              </button>
              <button type="button" class="btn btn--ghost" :disabled="switching" @click="useAnotherIdentity">
                {{ switching ? t('contribute.resumeSwitching') : t('contribute.resumeNo') }}
              </button>
            </div>
            <p class="whois__warn">
              {{ me?.code ? t('contribute.resumeSwitchWarn') : t('contribute.resumeSwitchWarnNoCode') }}
            </p>
          </template>

          <template v-else>
            <section class="about about--dark">
              <h2 class="about__title">{{ t('contribute.codeAboutTitle') }}</h2>
              <i18n-t class="about__body" keypath="contribute.codeAboutBody" tag="p" scope="global">
                <template #code>
                  <code class="about__code">{{ t('contribute.codePlaceholder') }}</code>
                </template>
                <template #screenshot>
                  <strong class="about__strong">{{ t('contribute.codeAboutScreenshot') }}</strong>
                </template>
              </i18n-t>
            </section>

            <div class="actions">
              <button v-if="open" type="button" class="btn btn--fill" @click="stage = 'create'">
                {{ t('contribute.getCode') }}
              </button>
              <button type="button" class="btn btn--ghost" @click="stage = 'claim'">
                {{ t('contribute.haveCode') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- ── Stage 2a: get your code ──────────────────────────────────────── -->
    <section v-else-if="stage === 'create'" class="panel">
      <div class="panel__inner">
        <p class="eyebrow-line">{{ t('contribute.eyebrow') }}</p>
        <h1 class="panel__title">{{ t('contribute.createTitle') }}</h1>

        <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>

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
          >
          <p class="field__hint">{{ t('contribute.nameHint') }}</p>
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
          >
          <!-- The hint rewrites itself with the switch: the same field means two
               different things depending on whether it will be published. -->
          <p class="field__hint">
            {{ creditHandle ? t('contribute.contactHintPublic') : t('contribute.contactHintPrivate') }}
          </p>
        </div>

        <!-- Squared, not a pill. This is a consent control, and everything else
             on the site is right angles. -->
        <button
          type="button"
          class="switch"
          role="switch"
          :aria-checked="creditHandle"
          @click="creditHandle = !creditHandle"
        >
          <span class="switch__box" :class="{ 'is-on': creditHandle }" aria-hidden="true">
            <span class="switch__knob" />
          </span>
          <span class="switch__label">{{ t('contribute.creditSwitch') }}</span>
        </button>

        <div class="actions actions--stack">
          <button type="button" class="btn btn--fill" :disabled="creating" @click="createCode">
            {{ creating ? t('contribute.creating') : t('contribute.createCode') }}
          </button>
          <button type="button" class="linkbtn" @click="stage = 'welcome'">{{ t('contribute.back') }}</button>
        </div>
      </div>
    </section>

    <!-- ── Stage 2b: code issued ────────────────────────────────────────── -->
    <section v-else-if="stage === 'issued'" class="panel">
      <div class="panel__inner">
        <p class="eyebrow-line">{{ t('contribute.codeLabel') }}</p>

        <button type="button" class="codeframe" :aria-label="t('contribute.copyCodeAria')" @click="copyCode">
          <span class="codeframe__value">{{ me?.code }}</span>
        </button>

        <p class="panel__lead">{{ t('contribute.issuedLead') }}</p>

        <i18n-t class="warn" keypath="contribute.issuedWarn" tag="p" scope="global">
          <template #emphasis>
            <strong class="warn__strong">{{ t('contribute.issuedWarnEmphasis') }}</strong>
          </template>
        </i18n-t>

        <div class="actions actions--stack">
          <button type="button" class="btn btn--ghost" @click="copyCode">{{ t('contribute.copyCode') }}</button>
          <button type="button" class="btn btn--fill" @click="stage = 'upload'">
            {{ t('contribute.issuedContinue') }}
          </button>
        </div>
      </div>
    </section>

    <!-- ── Stage 2c: enter a code ───────────────────────────────────────── -->
    <section v-else-if="stage === 'claim'" class="panel">
      <div class="panel__inner">
        <p class="eyebrow-line">{{ t('contribute.eyebrow') }}</p>
        <h1 class="panel__title">{{ t('contribute.claimTitle') }}</h1>

        <div class="field">
          <label class="field__label" for="contrib-code">{{ t('contribute.codeLabel') }}</label>
          <input
            id="contrib-code"
            class="field__input field__input--code"
            type="text"
            autocapitalize="characters"
            autocomplete="off"
            spellcheck="false"
            maxlength="16"
            :value="codeInput"
            :placeholder="t('contribute.codePlaceholder')"
            @input="onCodeInput"
            @keyup.enter="claimCode"
          >
          <p v-if="claimError" class="field__error">{{ claimError }}</p>
        </div>

        <div class="actions actions--stack">
          <button type="button" class="btn btn--fill" :disabled="claiming" @click="claimCode">
            {{ claiming ? t('contribute.checking') : t('contribute.useCode') }}
          </button>
          <button v-if="open" type="button" class="linkbtn" @click="stage = 'create'">
            {{ t('contribute.claimToGetCode') }}
          </button>
          <button type="button" class="linkbtn" @click="stage = 'welcome'">{{ t('contribute.back') }}</button>
        </div>
      </div>
    </section>

    <!-- ── Stage 3: upload ──────────────────────────────────────────────── -->
    <template v-else>
      <!-- Sticky because the counter, the code and the selection actions all
           have to stay reachable while someone scrolls a wall of thumbnails. -->
      <div class="topbar">
        <div class="topbar__row topbar__row--title">
          <div class="topbar__id">
            <p class="eyebrow-line">{{ t('contribute.eyebrow') }}</p>
            <p class="topbar__label">{{ heading }}</p>
          </div>
          <button
            v-if="me?.code"
            type="button"
            class="chip"
            :aria-label="t('contribute.copyCodeAria')"
            @click="copyCode"
          >{{ me.code }}</button>
        </div>

        <div v-if="selectionCount" class="topbar__row topbar__row--select">
          <span class="topbar__count">{{ t('contribute.selectedCount', { n: selectionCount }) }}</span>
          <div class="topbar__actions">
            <button type="button" class="minibtn" @click="clearSelection">{{ t('contribute.cancel') }}</button>
            <button type="button" class="minibtn minibtn--accent" :disabled="removing" @click="confirmOpen = true">
              {{ t('contribute.remove') }}
            </button>
          </div>
        </div>
        <div v-else class="topbar__row">
          <span class="topbar__count" :class="{ 'is-full': atLimit }">
            {{ t('contribute.counter', { used, max: link.maxPerContributor }) }}
          </span>
          <button v-if="mine.length" type="button" class="minibtn" @click="selectAll">
            {{ t('contribute.selectAll') }}
          </button>
        </div>

        <div
          class="meter"
          role="progressbar"
          :aria-valuenow="used"
          aria-valuemin="0"
          :aria-valuemax="link.maxPerContributor"
        >
          <span class="meter__fill" :style="{ transform: `scaleX(${meterRatio})` }" />
        </div>
      </div>

      <div class="work">
        <p v-if="errorMessage" class="alert">{{ errorMessage }}</p>
        <p v-if="!open" class="alert alert--quiet">{{ t('contribute.closed') }}</p>

        <!-- The dropzone is the page while nothing has landed, and a strip once
             the grid has something to show. -->
        <div v-if="open && !atLimit" class="zone" :class="mine.length ? 'zone--compact' : 'zone--full'">
          <AdminR2ImageUploader
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
        </div>
        <p v-else-if="open && atLimit" class="alert alert--quiet">
          {{ t('contribute.limitNotice', { max: link.maxPerContributor }) }}
        </p>

        <ul v-if="mine.length" class="pgrid">
          <li
            v-for="item in mine"
            :key="item.id"
            class="ptile"
            :class="{ 'is-selected': isSelected(item.id) }"
          >
            <button
              type="button"
              class="ptile__select"
              :aria-pressed="isSelected(item.id)"
              :aria-label="t('contribute.selectPhoto')"
              @click="toggleSelect(item.id)"
            >
              <img class="ptile__img" :src="item.previewUrl" alt="" loading="lazy">
            </button>

            <button
              type="button"
              class="ptile__ctl ptile__ctl--zoom"
              :aria-label="t('contribute.viewFullSize')"
              @click.stop="openViewer(item)"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" />
                <line x1="10.4" y1="10.4" x2="14" y2="14" />
              </svg>
            </button>

            <button
              v-if="open"
              type="button"
              class="ptile__ctl ptile__ctl--remove"
              :disabled="removing"
              :aria-label="t('contribute.removePhoto')"
              @click.stop="removeOne(item)"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
                <line x1="4" y1="4" x2="12" y2="12" />
                <line x1="12" y1="4" x2="4" y2="12" />
              </svg>
            </button>
          </li>
        </ul>
        <p v-else-if="!loadingMine" class="empty">{{ t('contribute.empty') }}</p>

        <section v-if="open" class="notebox">
          <label class="field__label" for="contrib-note">{{ t('contribute.noteLabel') }}</label>
          <textarea
            id="contrib-note"
            v-model="noteInput"
            class="field__input notebox__area"
            rows="3"
            maxlength="2000"
            :placeholder="t('contribute.notePlaceholder')"
            @blur="saveNote"
          />
          <p class="field__hint">
            <span v-if="noteSaved" class="field__saved">{{ t('contribute.saved') }}</span>
            <span v-else>{{ t('contribute.noteHint') }}</span>
          </p>
        </section>
      </div>
    </template>

    <!-- ── Full-size viewer ─────────────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="viewerItem" class="viewer" @click="closeViewer">
        <img class="viewer__img" :src="viewerItem.previewUrl" alt="" @click.stop>
        <button
          type="button"
          class="viewer__close"
          :aria-label="t('contribute.closeViewer')"
          @click.stop="closeViewer"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true">
            <line x1="4" y1="4" x2="12" y2="12" />
            <line x1="12" y1="4" x2="4" y2="12" />
          </svg>
        </button>
      </div>
    </Teleport>

    <!-- ── Remove confirmation ──────────────────────────────────────────── -->
    <UiModal
      :model-value="confirmOpen"
      :title="selectionCount === 1
        ? t('contribute.removeConfirmOne')
        : t('contribute.removeConfirmMany', { count: selectionCount })"
      @update:model-value="value => { if (!value) confirmOpen = false }"
    >
      <p class="confirm-text">{{ t('contribute.removeConfirmBody') }}</p>
      <div class="confirm-actions">
        <!-- Cancel takes focus: a stray tap must land on the safe one. -->
        <button ref="cancelButton" type="button" class="minibtn" @click="confirmOpen = false">
          {{ t('contribute.cancel') }}
        </button>
        <button type="button" class="minibtn minibtn--accent" :disabled="removing" @click="removeSelected">
          {{ t('contribute.remove') }}
        </button>
      </div>
    </UiModal>

    <!-- ── Toast ────────────────────────────────────────────────────────── -->
    <Transition name="toast">
      <p v-if="toast" class="toast" role="status">{{ toast }}</p>
    </Transition>
  </div>
</template>

<style scoped>
.contrib { display: flex; flex-direction: column; }

/* ── The dark stage (welcome header + not-found) ────────────────────────── */
.stage {
  position: relative;
  background: var(--hero-bg);
  overflow: hidden;
}
/* No cover: the club's own gradient, a deliberate treatment rather than a
   stand-in for a missing photo. */
.stage::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--dark) 0%, #2A1A24 55%, var(--accent) 220%);
}
.stage--cover::before { display: none; }
.stage--solo { min-height: 100vh; display: flex; align-items: center; }

/* AppImg's root element is the <img> itself, so this targets it directly. */
.stage__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.stage--cover::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(12, 12, 10, 0.2) 0%, rgba(12, 12, 10, 0.86) 100%);
}
.stage__body {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 980px;
  margin: 0 auto;
  padding: 2.75rem 1.5rem 3.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.stage__body--narrow { max-width: 44rem; }

.mark {
  font-family: var(--font-latin-sans);
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.22em;
  color: rgba(245, 244, 240, 0.72);
  user-select: none;
  margin-bottom: 1.75rem;
}
.mark__cu { color: var(--accent); }

.eyebrow-line {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--accent);
}

.stage__title {
  font-family: var(--font-serif);
  font-size: clamp(2rem, 5.5vw, 3.4rem);
  font-weight: 300;
  line-height: 1.06;
  color: #F5F4F0;
}
.stage__meta {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: rgba(245, 244, 240, 0.68);
}
.stage__meta-sep { color: var(--accent); }
.stage__desc,
.stage__lead {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.65;
  color: rgba(245, 244, 240, 0.82);
  max-width: 52ch;
}

.notes {
  list-style: none;
  margin: 0.5rem 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.notes li {
  position: relative;
  padding-left: 1rem;
  font-family: var(--font-sans);
  font-size: 0.78rem;
  line-height: 1.65;
  color: rgba(245, 244, 240, 0.5);
  max-width: 52ch;
}
.notes li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.72em;
  width: 5px;
  height: 1px;
  background: var(--accent);
}

/* ── Welcome: one dark surface ──────────────────────────────────────────────
   Mobile stacks (cover band, then content); desktop splits (cover left,
   content right). The min-heights matter because a collection often has no
   description — without them the panel collapses to a strip. */
.wstage {
  position: relative;
  background: var(--hero-bg);
  color: #F5F4F0;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
}
.wstage__art {
  position: relative;
  flex: none;
  min-height: 40vh;
  overflow: hidden;
}
/* No cover: the club's own gradient, a deliberate treatment rather than a
   stand-in for a missing photo. */
.wstage:not(.wstage--cover) .wstage__art::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--dark) 0%, #2A1A24 55%, var(--accent) 220%);
}
/* AppImg's root element is the <img> itself, so this targets it directly. */
.wstage__cover {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* Fades the photo into the panel below, and keeps the mark legible on any
   image the admin happens to upload. */
.wstage__art::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(12, 12, 10, 0.28) 0%, rgba(12, 12, 10, 0.1) 38%, var(--hero-bg) 100%);
}
.wstage__art .mark {
  position: absolute;
  z-index: 2;
  top: 1.15rem;
  left: 1.5rem;
  margin: 0;
}
.wstage__panel {
  position: relative;
  z-index: 1;
  flex: 1;
  margin-top: -3.25rem;
  padding: 0 1.5rem 3rem;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;
}
.cut-line--inset { margin: 1.5rem 0 0.35rem; }

.about--dark {
  border-color: rgba(245, 244, 240, 0.16);
  background: rgba(245, 244, 240, 0.05);
}
.about--dark .about__title { color: rgba(245, 244, 240, 0.7); }
.about--dark .about__body { color: rgba(245, 244, 240, 0.82); }
.about--dark .about__strong { color: #F5F4F0; }
.alert--dark { color: rgba(245, 244, 240, 0.85); }

/* ── "Is this still you?" ────────────────────────────────────
   Sits on the welcome's dark panel, so it borrows .about--dark's ground rather
   than inventing a second card treatment for the same surface. */
.whois {
  border: 1px solid rgba(245, 244, 240, 0.16);
  background: rgba(245, 244, 240, 0.05);
  padding: 1.25rem 1.5rem 1.4rem;
  max-width: 48rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.whois__title {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.6);
  margin-bottom: 0.5rem;
}
.whois__name {
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 4.5vw, 1.6rem);
  font-weight: 300;
  line-height: 1.2;
  color: #F5F4F0;
  overflow-wrap: anywhere;
}
/* Italic, not muted-to-the-edge: anonymous is what most people choose, so it
   reads as an answer rather than as a field someone forgot to fill in. */
.whois__name--anon { font-style: italic; color: rgba(245, 244, 240, 0.7); }
.whois__meta {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.55);
}
.whois__code {
  margin-top: 0.9rem;
  border: 0;
  border-top: 1px solid rgba(245, 244, 240, 0.16);
  background: transparent;
  padding: 0.85rem 0 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  text-align: left;
  cursor: pointer;
}
.whois__code-label {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.5);
}
.whois__code-value {
  font-family: var(--font-latin-sans);
  font-size: clamp(1rem, 4.5vw, 1.3rem);
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--accent);
  word-break: break-all;
  transition: color 0.15s;
}
.whois__code:hover .whois__code-value { color: #F5F4F0; }

.whois__warn {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  line-height: 1.6;
  color: rgba(245, 244, 240, 0.5);
  max-width: 46ch;
}

@media (min-width: 900px) {
  .wstage {
    display: grid;
    grid-template-columns: 1.05fr 0.95fr;
    align-items: stretch;
  }
  .wstage__art { min-height: 100%; }
  /* Sideways on desktop: the seam is now the vertical edge between the photo
     and the panel, not the bottom of a banner. */
  .wstage__art::after {
    background: linear-gradient(to right, rgba(12, 12, 10, 0.05) 45%, rgba(12, 12, 10, 0.5) 100%);
  }
  .wstage__panel {
    margin-top: 0;
    padding: 4rem 3.25rem;
    justify-content: center;
    max-width: 34rem;
  }
  .wstage__panel .actions { flex-wrap: nowrap; }
  .wstage__panel .actions .btn { flex: 1; }
}

/* .about is shared: dark on the welcome stage (.about--dark), paper elsewhere. */
.about {
  border: 1px solid var(--subtle);
  background: var(--paper);
  padding: 1.4rem 1.5rem;
  max-width: 48rem;
}
.about__title {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.85rem;
}
.about__body {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.75;
  color: var(--dark);
}
.about__code {
  font-family: var(--font-latin-sans);
  font-size: 0.88rem;
  letter-spacing: 0.1em;
  color: var(--accent);
  white-space: nowrap;
}
.about__strong { font-weight: 600; color: var(--dark); }

/* ── Buttons ────────────────────────────────────────────────────────────── */
.actions { display: flex; flex-wrap: wrap; gap: 0.7rem; }
/* Two answers to one question, so neither may end up the smaller target: a row
   apiece on a phone, and equal columns once the 900px rule below takes over
   with the higher specificity it already has. */
.actions--answer .btn { flex: 1 1 100%; }
.actions--stack { flex-direction: column; align-items: stretch; margin-top: 0.5rem; }

.btn {
  border: 1px solid var(--accent);
  background: transparent;
  padding: 0.85rem 1.4rem;
  font-family: var(--font-sans);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  text-align: center;
  text-decoration: none;
  color: var(--accent);
  cursor: pointer;
  transition: background-color 0.18s, color 0.18s, border-color 0.18s;
}
.btn--fill { background: var(--accent); color: #F5F4F0; }
.btn--fill:hover { background: transparent; color: var(--accent); }
.btn--ghost { border-color: rgba(245, 244, 240, 0.35); color: rgba(245, 244, 240, 0.85); }
.btn--ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn:disabled { opacity: 0.45; cursor: default; }

/* The ghost button needs ink, not paper-white, once it sits on paper. */
.panel .btn--ghost { border-color: var(--subtle); color: var(--dark); }
.panel .btn--ghost:hover { border-color: var(--accent); color: var(--accent); }

.linkbtn {
  border: 0;
  background: transparent;
  padding: 0.4rem 0;
  font-family: var(--font-sans);
  font-size: 0.68rem;
  color: var(--muted);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.linkbtn:hover { color: var(--accent); }

/* ── Identity panels ────────────────────────────────────────────────────── */
.panel {
  min-height: 70vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 3.5rem 1.25rem 4rem;
}
.panel__inner {
  width: 100%;
  max-width: 470px;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
}
.panel__title {
  font-family: var(--font-serif);
  font-size: clamp(1.7rem, 5vw, 2.3rem);
  font-weight: 300;
  line-height: 1.1;
  color: var(--dark);
}
.panel__lead {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.7;
  color: var(--dark);
}

.field { display: flex; flex-direction: column; gap: 0.4rem; }
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
  padding: 0.7rem 0.8rem;
  font-family: var(--font-serif);
  font-size: 0.95rem;
  color: var(--dark);
}
.field__input:focus { outline: none; border-color: var(--accent); }
.field__input--code {
  font-family: var(--font-latin-sans);
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.field__hint {
  font-family: var(--font-sans);
  font-size: 0.68rem;
  line-height: 1.55;
  color: var(--muted);
}
.field__saved { color: var(--accent); }
.field__error {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  line-height: 1.55;
  color: var(--accent);
}

/* Squared switch — a consent control, not a pill. */
.switch {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  border: 0;
  background: transparent;
  padding: 0.2rem 0;
  cursor: pointer;
  text-align: left;
}
.switch__box {
  flex: none;
  width: 2.6rem;
  height: 1.3rem;
  border: 1px solid var(--subtle);
  background: #fff;
  display: block;
  position: relative;
  transition: border-color 0.18s, background-color 0.18s;
}
.switch__box.is-on { border-color: var(--accent); background: var(--accent); }
.switch__knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: calc(1.3rem - 6px);
  height: calc(1.3rem - 6px);
  background: var(--muted);
  transition: transform 0.18s, background-color 0.18s;
}
.switch__box.is-on .switch__knob {
  background: #F5F4F0;
  transform: translateX(1.3rem);
}
.switch__label {
  font-family: var(--font-sans);
  font-size: 0.8rem;
  color: var(--dark);
}

/* ── Code issued ────────────────────────────────────────────────────────── */
.codeframe {
  display: block;
  width: 100%;
  border: 0;
  border-top: 2px solid var(--accent);
  border-bottom: 2px solid var(--accent);
  background: transparent;
  padding: 1.5rem 0;
  cursor: pointer;
  text-align: left;
}
.codeframe__value {
  font-family: var(--font-latin-sans);
  font-size: clamp(1.25rem, 6.5vw, 2.1rem);
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--dark);
  word-break: break-all;
}
.warn {
  border-left: 2px solid var(--accent);
  padding: 0.55rem 0 0.55rem 0.9rem;
  font-family: var(--font-sans);
  font-size: 0.82rem;
  line-height: 1.7;
  color: var(--muted);
}
.warn__strong { font-weight: 600; color: var(--dark); }

/* ── Sticky top bar ─────────────────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--body-bg);
  border-bottom: 1px solid var(--subtle);
  padding: 0.7rem 1.1rem 0;
}
.topbar__row {
  max-width: 1180px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-bottom: 0.55rem;
}
.topbar__row--title { align-items: flex-start; }
.topbar__id { display: flex; flex-direction: column; gap: 0.25rem; min-width: 0; }
.topbar__label {
  font-family: var(--font-serif);
  font-size: 1rem;
  line-height: 1.2;
  color: var(--dark);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.topbar__count {
  font-family: var(--font-sans);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}
.topbar__count.is-full { color: var(--accent); }
.topbar__row--select .topbar__count { color: var(--accent); }
.topbar__actions { display: flex; gap: 0.4rem; }

.chip {
  flex: none;
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.35rem 0.6rem;
  font-family: var(--font-latin-sans);
  font-size: 0.62rem;
  letter-spacing: 0.1em;
  color: var(--dark);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.chip:hover { border-color: var(--accent); color: var(--accent); }

.minibtn {
  border: 1px solid var(--subtle);
  background: transparent;
  padding: 0.32rem 0.65rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.minibtn:hover { border-color: var(--accent); color: var(--accent); }
.minibtn:disabled { opacity: 0.5; cursor: default; }
.minibtn--accent { border-color: var(--accent); color: var(--accent); }

/* The hairline under both rows: how full their allowance is, at a glance. */
.meter {
  max-width: 1180px;
  margin: 0 auto;
  height: 2px;
  background: var(--subtle);
  overflow: hidden;
}
.meter__fill {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent);
  transform-origin: left center;
  transition: transform 0.25s ease;
}

/* ── Work area ──────────────────────────────────────────────────────────── */
.work {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.1rem 1.1rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.alert {
  border-left: 2px solid var(--accent);
  padding: 0.6rem 0.9rem;
  background: var(--paper);
  font-family: var(--font-sans);
  font-size: 0.8rem;
  line-height: 1.6;
  color: var(--dark);
}
.alert--quiet { border-left-color: var(--subtle); color: var(--muted); }

/* The uploader owns its own dropzone markup, so both sizes are set through its
   root. Large while nothing has been sent; a strip once photos exist. */
.zone--full :deep(.r2up__zone) { min-height: 15rem; }
.zone--compact :deep(.r2up__zone) { min-height: 0; padding: 0.85rem 1rem; }
.zone--compact :deep(.r2up__icon),
.zone--compact :deep(.r2up__hint) { display: none; }

/* ── Photo grid ─────────────────────────────────────────────────────────── */
.pgrid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 3px;
}
@media (min-width: 900px) {
  .pgrid { grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px; }
}
.ptile {
  position: relative;
  aspect-ratio: 1 / 1;
  background: var(--subtle);
}
.ptile__select {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  margin: 0;
  padding: 0;
  background: transparent;
  cursor: pointer;
}
.ptile__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* Selection is the border and the wash — no checkbox. On a wall of thumbnails a
   checkbox is one more thing to hit and one more thing to read. */
.ptile::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  border: 2px solid transparent;
  background: transparent;
  transition: background-color 0.15s, border-color 0.15s;
}
.ptile.is-selected::after {
  border-color: var(--accent);
  background: rgba(232, 24, 110, 0.22);
}

.ptile__ctl {
  position: absolute;
  top: 4px;
  width: 1.65rem;
  height: 1.65rem;
  border: 0;
  padding: 0;
  background: rgba(12, 12, 10, 0.62);
  color: #F5F4F0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
}
.ptile__ctl svg { width: 0.85rem; height: 0.85rem; }
.ptile__ctl--zoom { left: 4px; }
.ptile__ctl--remove { right: 4px; }
.ptile__ctl:hover { background: var(--accent); }
.ptile:hover .ptile__ctl,
.ptile__ctl:focus-visible { opacity: 1; }
.ptile__ctl:disabled { cursor: default; }

/* This page is opened on phones far more than anywhere else on the site, and a
   hover-revealed control is simply unreachable there. */
@media (hover: none) {
  .ptile__ctl { opacity: 1; }
}

.empty {
  font-family: var(--font-sans);
  font-size: 0.75rem;
  color: var(--muted);
}

/* ── Note ───────────────────────────────────────────────────────────────── */
.notebox {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  max-width: 42rem;
  margin-top: 0.75rem;
}
.notebox__area {
  resize: vertical;
  min-height: 4.5rem;
  line-height: 1.6;
}

/* ── Full-size viewer ───────────────────────────────────────────────────── */
.viewer {
  position: fixed;
  inset: 0;
  z-index: 300;
  background: rgba(12, 12, 10, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
.viewer__img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.viewer__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2.4rem;
  height: 2.4rem;
  border: 1px solid rgba(245, 244, 240, 0.3);
  background: transparent;
  color: #F5F4F0;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.viewer__close svg { width: 1rem; height: 1rem; }
.viewer__close:hover { border-color: var(--accent); color: var(--accent); }

/* ── Confirm dialog body ────────────────────────────────────────────────── */
.confirm-text {
  font-family: var(--font-sans);
  font-size: 0.88rem;
  line-height: 1.65;
  color: var(--dark);
}
.confirm-actions { display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 1.4rem; }

/* ── Toast ──────────────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  left: 50%;
  bottom: 1.5rem;
  transform: translateX(-50%);
  z-index: 320;
  background: var(--dark);
  color: #F5F4F0;
  padding: 0.65rem 1.1rem;
  font-family: var(--font-sans);
  font-size: 0.74rem;
  letter-spacing: 0.03em;
  max-width: calc(100vw - 2rem);
  text-align: center;
}
.toast-enter-active,
.toast-leave-active { transition: opacity 0.2s, transform 0.2s; }
.toast-enter-from,
.toast-leave-to { opacity: 0; transform: translate(-50%, 0.5rem); }

@media (max-width: 640px) {
  .stage__body { padding: 2.25rem 1.1rem 2.5rem; }
  .welcome { padding: 2rem 1.1rem 3rem; }
  .about { padding: 1.15rem; }
  .panel { padding: 2.5rem 1.1rem 3rem; }
}
</style>
