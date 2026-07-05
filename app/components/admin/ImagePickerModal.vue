<script setup lang="ts">
const props = withDefaults(defineProps<{
  prefix?: string
  multiple?: boolean
  title?: string
}>(), {
  prefix: 'uploads',
  multiple: false
})

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ select: [keys: string[]] }>()

const { t } = useI18n()
const modalTitle = computed(() => props.title || t('adminPicker.title'))

interface LibraryImage {
  key: string
  uploadedAt?: string
  size?: number
}

type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc'

const libraryImages = ref<LibraryImage[]>([])
const loading = ref(false)
const selected = ref(new Set<string>())
const managerOpen = ref(false)
const sortMode = ref<SortMode>('newest')
const lastSelectedKey = ref<string | null>(null)

const sortedImages = computed(() => {
  return [...libraryImages.value].sort((a, b) => {
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0

    if (sortMode.value === 'oldest') return aTime - bTime || a.key.localeCompare(b.key)
    if (sortMode.value === 'name-asc') return a.key.localeCompare(b.key)
    if (sortMode.value === 'name-desc') return b.key.localeCompare(a.key)
    return bTime - aTime || a.key.localeCompare(b.key)
  })
})

async function loadLibrary() {
  loading.value = true
  try {
    const result = await $fetch<{ keys: string[], images?: LibraryImage[] }>('/api/admin/media', { query: { prefix: props.prefix } })
    libraryImages.value = result.images ?? result.keys.map(key => ({ key }))
  } catch {
    libraryImages.value = []
  } finally {
    loading.value = false
  }
}

watch(open, val => {
  if (!val) return
  selected.value = new Set()
  lastSelectedKey.value = null
  loadLibrary()
})

watch(managerOpen, val => {
  if (!val) loadLibrary()
})

function toggleItem(key: string, event?: MouseEvent) {
  if (!props.multiple) {
    emit('select', [key])
    open.value = false
    return
  }

  if (event?.shiftKey && lastSelectedKey.value) {
    const visibleKeys = sortedImages.value.map(image => image.key)
    const anchorIndex = visibleKeys.indexOf(lastSelectedKey.value)
    const targetIndex = visibleKeys.indexOf(key)

    if (anchorIndex !== -1 && targetIndex !== -1) {
      const start = Math.min(anchorIndex, targetIndex)
      const end = Math.max(anchorIndex, targetIndex)
      const range = visibleKeys.slice(start, end + 1)
      const orderedRange = anchorIndex <= targetIndex ? range : range.reverse()
      const next = new Set(selected.value)

      for (const rangeKey of orderedRange) next.add(rangeKey)
      selected.value = next
      lastSelectedKey.value = key
      return
    }
  }

  const next = new Set(selected.value)
  next.has(key) ? next.delete(key) : next.add(key)
  selected.value = next
  lastSelectedKey.value = key
}

function confirm() {
  emit('select', [...selected.value])
  open.value = false
}

function selectionOrder(key: string) {
  const index = [...selected.value].indexOf(key)
  return index >= 0 ? index + 1 : null
}
</script>

<template>
  <UiModal v-model="open" :title="modalTitle" size="xl" flush>
    <div class="picker">

      <!-- Library -->
      <div class="picker__library">
        <div v-if="loading" class="picker__state">
          <UiSpinner />
          <span>{{ t('adminPicker.loading') }}</span>
        </div>
        <p v-else-if="!libraryImages.length" class="picker__empty">
          {{ t('adminPicker.empty') }}
        </p>
        <template v-else>
          <div class="picker__toolbar">
            <label class="picker__sort">
              <span>{{ t('adminPicker.sortBy') }}</span>
              <select v-model="sortMode">
                <option value="newest">{{ t('adminPicker.sortNewest') }}</option>
                <option value="oldest">{{ t('adminPicker.sortOldest') }}</option>
                <option value="name-asc">{{ t('adminPicker.sortNameAsc') }}</option>
                <option value="name-desc">{{ t('adminPicker.sortNameDesc') }}</option>
              </select>
            </label>
            <span class="picker__total">{{ t('adminPicker.imageCount', { count: sortedImages.length }) }}</span>
          </div>
          <div class="picker__grid">
            <button
              v-for="image in sortedImages"
              :key="image.key"
              type="button"
              class="picker__item"
              :class="{ 'is-selected': selected.has(image.key) }"
              @click="toggleItem(image.key, $event)"
            >
              <img :src="`/images/${image.key}`" alt="" loading="lazy">
              <span v-if="selected.has(image.key)" class="picker__order" aria-hidden="true">
                {{ selectionOrder(image.key) }}
              </span>
            </button>
          </div>
        </template>
      </div>

      <!-- Footer -->
      <div class="picker__footer">
        <button type="button" class="picker__manage" @click="managerOpen = true">
          {{ t('adminPicker.managePhotos') }}
        </button>
        <div class="picker__actions">
          <span v-if="multiple && selected.size" class="picker__count">
            {{ t('adminPicker.selectedCount', { count: selected.size }) }}
          </span>
          <UiButton variant="secondary" @click="open = false">{{ t('adminPicker.cancel') }}</UiButton>
          <UiButton v-if="multiple" :disabled="!selected.size" @click="confirm">
            {{ t('adminPicker.select') }}
          </UiButton>
        </div>
      </div>

    </div>
  </UiModal>

  <AdminPhotoManager v-model="managerOpen" :prefix="prefix" />
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  height: min(80svh, 760px);
}

/* ── Library ── */
.picker__library {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--subtle) transparent;
}
.picker__library::-webkit-scrollbar { width: 5px; }
.picker__library::-webkit-scrollbar-track { background: transparent; }
.picker__library::-webkit-scrollbar-thumb { background: var(--subtle); border-radius: 9px; }

.picker__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  height: 100%;
  color: var(--muted);
  font-size: 0.72rem;
}

.picker__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  font-size: 0.72rem;
  color: var(--muted);
}

.picker__toolbar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 0.9rem;
  border-bottom: 1px solid var(--subtle);
  background: var(--body-bg);
}

.picker__sort {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.picker__sort span,
.picker__total {
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.picker__sort select {
  min-height: 2.1rem;
  min-width: 10.5rem;
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.66rem;
  padding: 0 0.55rem;
  outline: none;
}
.picker__sort select:focus {
  border-color: var(--accent);
}

.picker__grid {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.75rem 0.9rem;
}

.picker__item {
  position: relative;
  height: 150px;
  overflow: hidden;
  background: var(--paper);
  border: 1px solid var(--subtle);
  cursor: pointer;
  padding: 0;
}
.picker__item img {
  height: 100%;
  width: auto;
  max-width: 280px;
  object-fit: contain;
  display: block;
  transition: opacity 0.15s;
}
.picker__item:hover img { opacity: 0.85; }
.picker__item.is-selected img { opacity: 0.6; }
.picker__item.is-selected::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 2.5px solid var(--accent);
  pointer-events: none;
}

.picker__order {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  min-width: 1.45rem;
  height: 1.4rem;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-family: var(--font-sans);
  font-size: 0.62rem;
  font-weight: 600;
  line-height: 1;
  padding: 0 0.35rem;
}

/* ── Footer ── */
.picker__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.65rem 0.9rem;
  border-top: 1px solid var(--subtle);
  flex-shrink: 0;
}
.picker__actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-shrink: 0;
}
.picker__count {
  font-size: 0.68rem;
  color: var(--muted);
}

.picker__manage {
  background: none;
  border: none;
  padding: 0;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  color: var(--muted);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.picker__manage:hover { color: var(--dark); }

@media (max-width: 620px) {
  .picker__toolbar {
    align-items: stretch;
    flex-direction: column;
    gap: 0.55rem;
  }
  .picker__sort select {
    width: 100%;
  }
  .picker__item {
    height: 110px;
  }
  .picker__item img {
    max-width: 200px;
  }
}
</style>
