<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin'] })
const { t } = useI18n()
useHead({ title: () => t('admin.heroImagesTitle') })

const { data, refresh } = await useFetch<{ images: string[] }>('/api/admin/hero-images')
const images = ref<string[]>([])
watchEffect(() => { if (data.value) images.value = [...data.value.images] })

const pickerOpen = ref(false)
const saving = ref(false)
const savedMsg = ref('')

async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch('/api/admin/hero-images', { method: 'PUT', body: { images: images.value } })
    savedMsg.value = t('admin.saved')
    await refresh()
  } catch (e) {
    savedMsg.value = (e as { data?: { message?: string } })?.data?.message || t('admin.saveFailed')
  } finally {
    saving.value = false
  }
}

function onPicked(keys: string[]) {
  const existing = new Set(images.value)
  images.value = [...images.value, ...keys.filter(k => !existing.has(k))]
}

function removeImage(key: string) {
  images.value = images.value.filter(k => k !== key)
}
</script>

<template>
  <div class="hi">
    <div class="hi__head">
      <div>
        <h1 class="hi__title">{{ t('admin.heroImagesTitle') }}</h1>
        <p class="hi__lead">{{ t('admin.heroImagesLead') }}</p>
      </div>
      <div class="hi__actions">
        <UiButton variant="secondary" @click="pickerOpen = true">{{ t('admin.addImages') }}</UiButton>
        <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
      </div>
    </div>

    <div v-if="images.length" class="hi__grid">
      <div v-for="key in images" :key="key" class="hero-thumb">
        <img :src="`/images/${key}`" alt="" loading="lazy">
        <button type="button" class="hero-thumb__remove" :title="t('admin.removeImage')" @click="removeImage(key)">
          <Icon name="heroicons:trash" />
        </button>
      </div>
    </div>
    <p v-else class="hi__empty">{{ t('admin.heroImagesEmpty') }}</p>

    <div v-if="images.length" class="hi__footer">
      <UiButton :loading="saving" @click="save">{{ t('admin.save') }}</UiButton>
      <span v-if="savedMsg" class="hi__saved">{{ savedMsg }}</span>
    </div>

    <AdminImagePickerModal
      v-model="pickerOpen"
      prefix="hero"
      multiple
      :title="t('adminPicker.title')"
      @select="onPicked"
    />
  </div>
</template>

<style scoped>
.hi {
  max-width: 1040px;
  margin: 0 auto;
  padding: 2.5rem 2rem 5rem;
  display: grid;
  gap: 1.5rem;
}

.hi__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.hi__title {
  font-family: var(--font-sans);
  font-size: 1.05rem;
  font-weight: 500;
  color: var(--dark);
  margin-bottom: 0.35rem;
}

.hi__lead {
  font-size: 0.78rem;
  color: var(--muted);
  line-height: 1.6;
  max-width: 480px;
}

.hi__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}

.hi__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.75rem;
}

.hi__empty {
  padding: 3rem 1.5rem;
  border: 1px solid var(--subtle);
  background: var(--paper);
  text-align: center;
  font-size: 0.78rem;
  color: var(--muted);
}

.hi__footer {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.hi__saved {
  font-size: 0.72rem;
  color: var(--muted);
}

/* ── Thumbnails ── */
.hero-thumb {
  position: relative;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--subtle);
  background: var(--paper);
}
.hero-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.hero-thumb__remove {
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: rgba(245, 244, 240, 0.92);
  border: none;
  color: #b0243c;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 0.9rem;
}
.hero-thumb:hover .hero-thumb__remove { opacity: 1; }
</style>
