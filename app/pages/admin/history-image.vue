<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin'] })

const { t } = useI18n()
useHead({ title: () => t('admin.historyImageTitle') })

const { data, refresh } = await useFetch<{ image: string }>('/api/admin/history-image')
const image = ref('')
watchEffect(() => { image.value = data.value?.image ?? '' })

const pickerOpen = ref(false)
const saving = ref(false)
const savedMsg = ref('')

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
    await $fetch('/api/admin/history-image', {
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
  <div class="history-image">
    <header class="history-image__head">
      <div>
        <p class="history-image__kicker">03 · {{ t('nav.history') }}</p>
        <h1>{{ t('admin.historyImageTitle') }}</h1>
        <p class="history-image__lead">{{ t('admin.historyImageLead') }}</p>
      </div>
      <div class="history-image__actions">
        <UiButton variant="secondary" @click="pickerOpen = true">
          {{ image ? t('admin.changeImage') : t('admin.selectImage') }}
        </UiButton>
        <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
      </div>
    </header>

    <section v-if="image" class="history-image__selection" :aria-label="t('admin.historyImagePreviewAlt')">
      <div class="history-image__preview">
        <img :src="`/images/${image}`" :alt="t('admin.historyImagePreviewAlt')">
      </div>
      <div class="history-image__meta">
        <div>
          <span>{{ t('admin.selectedImage') }}</span>
          <code>{{ image }}</code>
        </div>
        <UiButton variant="secondary" @click="clearImage">{{ t('admin.clearSelection') }}</UiButton>
      </div>
    </section>

    <button v-else type="button" class="history-image__empty" @click="pickerOpen = true">
      <Icon name="heroicons:photo" aria-hidden="true" />
      <strong>{{ t('admin.historyImageEmpty') }}</strong>
      <span>{{ t('admin.historyImageEmptyHint') }}</span>
    </button>

    <p v-if="savedMsg" class="history-image__status" role="status">{{ savedMsg }}</p>

    <AdminImagePickerModal
      v-model="pickerOpen"
      prefix="history"
      :title="t('admin.historyImagePickerTitle')"
      @select="onPicked"
    />
  </div>
</template>

<style scoped>
.history-image {
  display: grid;
  gap: 2rem;
  max-width: 1040px;
  margin: 0 auto;
  padding: 2.5rem 2rem 5rem;
}

.history-image__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
}

.history-image__kicker,
.history-image__meta span {
  color: var(--accent);
  font-size: 0.54rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.history-image__head h1 {
  margin: 0.65rem 0 0.75rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(2.8rem, 6vw, 5.5rem);
  font-weight: 200;
  letter-spacing: -0.035em;
  line-height: 0.95;
}

.history-image__lead {
  max-width: 560px;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.75;
}

.history-image__actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.history-image__selection {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  border-top: 2px solid var(--accent);
  background: #2C2A26;
}

.history-image__preview {
  min-height: 420px;
  overflow: hidden;
}

.history-image__preview img {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 420px;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  filter: sepia(0.5) contrast(1.1) brightness(0.82);
}

.history-image__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 2rem;
  padding: 1.5rem;
  color: #F0EDE6;
}

.history-image__meta div { min-width: 0; }
.history-image__meta span { display: block; margin-bottom: 0.7rem; }
.history-image__meta code {
  display: block;
  overflow-wrap: anywhere;
  color: rgba(240, 237, 230, 0.65);
  font-family: var(--font-sans);
  font-size: 0.68rem;
  line-height: 1.6;
}

.history-image__empty {
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

.history-image__empty:hover,
.history-image__empty:focus-visible { border-color: var(--accent); color: var(--accent); }
.history-image__empty :deep(svg) { align-self: end; width: 2rem; height: 2rem; }
.history-image__empty strong { align-self: end; font-size: 0.8rem; font-weight: 500; }
.history-image__empty span { align-self: start; max-width: 380px; color: var(--muted); font-size: 0.7rem; line-height: 1.6; }
.history-image__status { color: var(--muted); font-size: 0.72rem; }

@media (max-width: 760px) {
  .history-image__head { flex-direction: column; }
  .history-image__selection { grid-template-columns: 1fr; }
  .history-image__preview,
  .history-image__preview img { min-height: 280px; }
  .history-image__meta { min-height: 180px; }
}

@media (max-width: 520px) {
  .history-image { padding-inline: 1rem; }
  .history-image__actions { width: 100%; flex-wrap: wrap; }
}
</style>
