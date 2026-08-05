<script setup lang="ts">
const props = withDefaults(defineProps<{
  apiPath: string
  prefix: string
  sectionNumber: string
  sectionLabel: string
  title: string
  lead: string
  pickerTitle: string
  previewAlt: string
  emptyTitle: string
  emptyHint: string
  tone?: 'history' | 'clubroom'
}>(), {
  tone: 'history'
})

const { t } = useI18n()
const { data, refresh } = await useFetch<{ image: string }>(props.apiPath)
const image = ref('')
watchEffect(() => { image.value = data.value?.image ?? '' })

const pickerOpen = ref(false)
const saving = ref(false)
const savedMsg = ref('')

const previewSrc = computed(() => {
  const value = image.value.trim()
  if (!value) return ''
  if (/^(https?:)?\/\//.test(value) || value.startsWith('/') || value.startsWith('data:') || value.startsWith('blob:')) {
    return value
  }
  return `/images/${value.replace(/^\/+/, '')}`
})

function onPicked(keys: string[]) {
  image.value = keys[0] ?? ''
  savedMsg.value = ''
}

function clearImage() {
  image.value = ''
  savedMsg.value = ''
}

async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch(props.apiPath, {
      method: 'PUT',
      body: { image: image.value || null }
    })
    savedMsg.value = t('admin.saved')
    await refresh()
  } catch (error) {
    savedMsg.value = (error as { data?: { message?: string } })?.data?.message || t('admin.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="landing-image">
    <header class="landing-image__head">
      <div>
        <p class="landing-image__kicker">{{ sectionNumber }} · {{ sectionLabel }}</p>
        <h2>{{ title }}</h2>
        <p class="landing-image__lead">{{ lead }}</p>
      </div>
      <div class="landing-image__actions">
        <UiButton variant="secondary" @click="pickerOpen = true">
          {{ image ? t('admin.changeImage') : t('admin.selectImage') }}
        </UiButton>
        <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
      </div>
    </header>

    <section
      v-if="image"
      class="landing-image__selection"
      :class="`landing-image__selection--${tone}`"
      :aria-label="previewAlt"
    >
      <div class="landing-image__preview">
        <img :src="previewSrc" :alt="previewAlt">
      </div>
      <div class="landing-image__meta">
        <div>
          <span>{{ t('admin.selectedImage') }}</span>
          <code>{{ image }}</code>
        </div>
        <UiButton variant="secondary" @click="clearImage">{{ t('admin.clearSelection') }}</UiButton>
      </div>
    </section>

    <button v-else type="button" class="landing-image__empty" @click="pickerOpen = true">
      <Icon name="heroicons:photo" class="landing-image__empty-icon" aria-hidden="true" />
      <strong>{{ emptyTitle }}</strong>
      <span>{{ emptyHint }}</span>
    </button>

    <p v-if="savedMsg" class="landing-image__status" role="status">{{ savedMsg }}</p>

    <AdminImagePickerModal
      v-model="pickerOpen"
      :prefix="prefix"
      :title="pickerTitle"
      @select="onPicked"
    />
  </div>
</template>

<style scoped>
/* One editable landing-page image slot. Rendered as a block so several of
   them can stack on a single page — the page owns the outer padding, title
   and any dividers between blocks. */
.landing-image {
  display: grid;
  gap: 2rem;
}

.landing-image__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

.landing-image__kicker,
.landing-image__meta span {
  color: var(--accent);
  font-size: 0.54rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.landing-image__head h2 {
  margin: 0.65rem 0 0.75rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(1.9rem, 3.6vw, 2.9rem);
  font-weight: 200;
  letter-spacing: -0.03em;
  line-height: 1;
}

.landing-image__lead {
  max-width: 560px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.75;
}

.landing-image__actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.landing-image__selection {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  border-top: 2px solid var(--accent);
  background: #2C2A26;
}

.landing-image__selection--clubroom {
  grid-template-columns: minmax(320px, 0.75fr) minmax(240px, 0.25fr);
  background: var(--dark);
}

.landing-image__preview {
  min-height: 420px;
  overflow: hidden;
}

.landing-image__preview img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 420px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  filter: sepia(0.5) contrast(1.1) brightness(0.82);
}

.landing-image__selection--clubroom .landing-image__preview,
.landing-image__selection--clubroom .landing-image__preview img {
  min-height: 560px;
}

.landing-image__selection--clubroom .landing-image__preview img {
  aspect-ratio: 4 / 5;
  filter: grayscale(1) contrast(1.08);
}

.landing-image__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem;
  color: #F0EDE6;
}

.landing-image__meta div { min-width: 0; }
.landing-image__meta span { display: block; margin-bottom: 0.7rem; }
.landing-image__meta code {
  display: block;
  overflow-wrap: anywhere;
  color: rgba(240, 237, 230, 0.65);
  font-family: var(--font-sans);
  font-size: 0.68rem;
  line-height: 1.6;
}

.landing-image__empty {
  display: grid;
  justify-items: center;
  gap: 0.6rem;
  min-height: 360px;
  padding: 3rem;
  border: 1px solid var(--subtle);
  background: var(--paper);
  color: var(--dark);
  font-family: var(--font-sans);
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.landing-image__empty:hover,
.landing-image__empty:focus-visible { border-color: var(--accent); color: var(--accent); }
/* Sized on the Icon element itself: @nuxt/icon renders a span in css mode, so a
   `:deep(svg)` rule never matches and the icon falls back to 1em. Kept on
   currentColor + opacity so it picks up the button's accent hover. */
.landing-image__empty-icon {
  align-self: end;
  width: 2.75rem;
  height: 2.75rem;
  opacity: 0.45;
}
.landing-image__empty:hover .landing-image__empty-icon,
.landing-image__empty:focus-visible .landing-image__empty-icon { opacity: 1; }
.landing-image__empty strong { align-self: end; font-size: 0.8rem; font-weight: 500; }
.landing-image__empty span { align-self: start; max-width: 380px; color: var(--muted); font-size: 0.7rem; line-height: 1.6; }
.landing-image__status { color: var(--muted); font-size: 0.72rem; }

@media (max-width: 760px) {
  .landing-image__head { flex-direction: column; }
  .landing-image__selection,
  .landing-image__selection--clubroom { grid-template-columns: 1fr; }
  .landing-image__preview,
  .landing-image__preview img,
  .landing-image__selection--clubroom .landing-image__preview,
  .landing-image__selection--clubroom .landing-image__preview img { min-height: 280px; }
  .landing-image__meta { min-height: 180px; }
}

@media (max-width: 520px) {
  .landing-image__actions { width: 100%; flex-wrap: wrap; }
}
</style>
