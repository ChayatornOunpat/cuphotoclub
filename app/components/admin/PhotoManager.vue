<script setup lang="ts">
const props = withDefaults(defineProps<{
  prefix?: string
  title?: string
}>(), {
  prefix: 'uploads'
})

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ updated: [keys: string[]] }>()

const { t } = useI18n()
const modalTitle = computed(() => props.title || t('adminPhotoManager.title'))

const libraryKeys = ref<string[]>([])
const loading = ref(false)
const uploadQueue = ref<string[]>([])

async function load() {
  loading.value = true
  try {
    const { keys } = await $fetch<{ keys: string[] }>('/api/admin/media', { query: { prefix: props.prefix } })
    libraryKeys.value = keys
  } catch {
    libraryKeys.value = []
  } finally {
    loading.value = false
  }
}

watch(open, val => {
  if (val) { uploadQueue.value = []; load() }
})

function onUploaded(keys: string[]) {
  libraryKeys.value = [...keys, ...libraryKeys.value]
  emit('updated', keys)
}
</script>

<template>
  <UiModal v-model="open" :title="modalTitle" size="lg" flush>
    <div class="pm">
      <div class="pm__upload">
        <AdminR2ImageUploader
          v-model="uploadQueue"
          :prefix="prefix"
          :show-previews="false"
          @uploaded="onUploaded"
        />
      </div>

      <template v-if="loading || libraryKeys.length">
        <div class="pm__divider" />
        <div class="pm__gallery">
          <p class="pm__label">{{ t('adminPhotoManager.uploaded', { count: libraryKeys.length }) }}</p>
          <p v-if="loading && !libraryKeys.length" class="pm__empty">{{ t('adminPicker.loading') }}</p>
          <div v-else class="pm__grid">
            <div v-for="key in libraryKeys" :key="key" class="pm__thumb">
              <img :src="`/images/${key}`" alt="" loading="lazy">
            </div>
          </div>
        </div>
      </template>

      <div class="pm__footer">
        <NuxtLink class="pm__manage-link" to="/admin/r2-images">
          {{ t('adminPhotoManager.manageR2') }}
        </NuxtLink>
        <UiButton variant="secondary" @click="open = false">{{ t('adminPhotoManager.done') }}</UiButton>
      </div>
    </div>
  </UiModal>
</template>

<style scoped>
.pm { display: flex; flex-direction: column; }

.pm__upload { padding: 0.9rem; }

.pm__divider { height: 1px; background: var(--subtle); }

.pm__gallery {
  padding: 0.9rem;
  background: color-mix(in srgb, var(--body-bg) 55%, white);
}

.pm__label {
  font-size: 0.46rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.65rem;
}

.pm__grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.4rem;
}

.pm__thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--subtle);
  background: var(--paper);
}
.pm__thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.pm__empty {
  font-size: 0.58rem;
  color: var(--muted);
}

.pm__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding: 0.75rem 0.9rem;
  border-top: 1px solid var(--subtle);
  flex-shrink: 0;
}

.pm__manage-link {
  margin-right: auto;
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 0.15s;
}
.pm__manage-link:hover { color: var(--accent); }
</style>
