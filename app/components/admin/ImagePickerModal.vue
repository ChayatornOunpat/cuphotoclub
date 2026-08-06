<script setup lang="ts">
const props = withDefaults(defineProps<{
  prefix?: string
  multiple?: boolean
  title?: string
  initialSort?: SortMode
  // Optional multi-source mode: renders a source dropdown and loads one
  // source at a time. Callers that pass a single `prefix` are unaffected.
  sources?: PickerSource[]
}>(), {
  prefix: 'uploads',
  multiple: false,
  initialSort: 'newest',
  sources: undefined
})

const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ select: [keys: string[]] }>()

const { t } = useI18n()
const modalTitle = computed(() => props.title || t('adminPicker.title'))

interface LibraryImage {
  key: string
  uploadedAt?: string
  orderAt?: number
  size?: number
}

// Not exported: `<script setup>` forbids ES exports. Callers pass a matching
// object literal and structural typing does the rest.
interface PickerSource {
  label: string
  prefix: string
}

type SortMode = 'newest' | 'oldest' | 'name-asc' | 'name-desc'
type ThumbnailSize = 'small' | 'medium' | 'large'

const THUMBNAIL_SIZE_OPTIONS: { value: ThumbnailSize, labelKey: string, height: number, maxWidth: number }[] = [
  { value: 'small', labelKey: 'adminPicker.sizeSmall', height: 112, maxWidth: 210 },
  { value: 'medium', labelKey: 'adminPicker.sizeMedium', height: 150, maxWidth: 280 },
  { value: 'large', labelKey: 'adminPicker.sizeLarge', height: 210, maxWidth: 390 }
]

const libraryImages = ref<LibraryImage[]>([])
const loading = ref(false)
const selected = ref(new Set<string>())
const managerOpen = ref(false)
const sortMode = ref<SortMode>('newest')
const thumbnailSize = ref<ThumbnailSize>('medium')
const lastSelectedKey = ref<string | null>(null)
const activeSourceIndex = ref(0)

// Single-prefix callers keep their old behaviour; multi-source callers drive
// the listing from the dropdown instead.
const activePrefix = computed(() => {
  const list = props.sources
  if (!list?.length) return props.prefix
  return list[activeSourceIndex.value]?.prefix ?? list[0]?.prefix ?? props.prefix
})

// orderAt is the upload queue-order stamp; uploadedAt (completion time) covers
// images uploaded before the stamp existed. An image with neither is almost
// always a just-uploaded object whose R2 metadata hasn't propagated yet — treat
// it as the newest so it doesn't leap to the front of oldest-first ordering.
function imageTime(image: LibraryImage) {
  if (image.orderAt && image.orderAt > 0) return image.orderAt
  if (image.uploadedAt) {
    const uploaded = new Date(image.uploadedAt).getTime()
    if (uploaded > 0) return uploaded
  }
  return Number.MAX_SAFE_INTEGER
}

const sortedImages = computed(() => {
  return [...libraryImages.value].sort((a, b) => {
    if (sortMode.value === 'oldest') return imageTime(a) - imageTime(b) || a.key.localeCompare(b.key)
    if (sortMode.value === 'name-asc') return a.key.localeCompare(b.key)
    if (sortMode.value === 'name-desc') return b.key.localeCompare(a.key)
    return imageTime(b) - imageTime(a) || a.key.localeCompare(b.key)
  })
})

const thumbnailGridStyle = computed(() => {
  const option = THUMBNAIL_SIZE_OPTIONS.find(item => item.value === thumbnailSize.value) ?? THUMBNAIL_SIZE_OPTIONS[1]!
  return {
    '--picker-thumb-height': `${option.height}px`,
    '--picker-thumb-max-width': `${option.maxWidth}px`
  }
})

async function loadLibrary() {
  const requested = activePrefix.value
  loading.value = true
  try {
    const result = await $fetch<{ keys: string[], images?: LibraryImage[] }>('/api/admin/media', { query: { prefix: requested } })
    // A slow response for a source the user has already switched away from
    // must not overwrite the newer one.
    if (requested !== activePrefix.value) return
    libraryImages.value = result.images ?? result.keys.map(key => ({ key }))
  } catch {
    if (requested === activePrefix.value) libraryImages.value = []
  } finally {
    if (requested === activePrefix.value) loading.value = false
  }
}

watch(open, val => {
  if (!val) return
  selected.value = new Set()
  lastSelectedKey.value = null
  sortMode.value = props.initialSort
  activeSourceIndex.value = 0
  loadLibrary()
})

// Switching source reloads the grid. Selection deliberately survives the
// switch so images can be gathered from several albums in one pass; the
// shift-range anchor does not, since it refers to the old grid.
watch(activePrefix, () => {
  if (!open.value) return
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
  // Emit in selection order. Shift-click ranges are inserted in visible order,
  // then later individual picks append after the existing selection.
  emit('select', [...selected.value])
  open.value = false
}

// Badge shows the order images will be handed off in.
const selectionOrderMap = computed(() => {
  const map = new Map<string, number>()
  let n = 0
  for (const key of selected.value) map.set(key, ++n)
  return map
})

function selectionOrder(key: string) {
  return selectionOrderMap.value.get(key) ?? null
}
</script>

<template>
  <UiModal v-model="open" :title="modalTitle" size="xl" flush>
    <div class="picker">

      <!--
        Sits outside .picker__library on purpose: the library swaps between
        loading / empty / grid states, and the source dropdown has to stay
        reachable in all three — otherwise picking an empty album would strand
        the user with no way back.
      -->
      <div v-if="sources?.length" class="picker__sources">
        <label class="picker__source">
          <span>{{ t('adminPicker.source') }}</span>
          <select v-model="activeSourceIndex">
            <option v-for="(source, index) in sources" :key="source.prefix" :value="index">
              {{ source.label }}
            </option>
          </select>
        </label>
      </div>

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
            <div class="picker__controls">
              <label class="picker__sort">
                <span>{{ t('adminPicker.sortBy') }}</span>
                <select v-model="sortMode">
                  <option value="newest">{{ t('adminPicker.sortNewest') }}</option>
                  <option value="oldest">{{ t('adminPicker.sortOldest') }}</option>
                  <option value="name-asc">{{ t('adminPicker.sortNameAsc') }}</option>
                  <option value="name-desc">{{ t('adminPicker.sortNameDesc') }}</option>
                </select>
              </label>
              <div class="picker__size" role="group" :aria-label="t('adminPicker.sizeLabel')">
                <span>{{ t('adminPicker.sizeLabel') }}</span>
                <div class="picker__size-options">
                  <button
                    v-for="option in THUMBNAIL_SIZE_OPTIONS"
                    :key="option.value"
                    type="button"
                    :class="{ 'is-active': thumbnailSize === option.value }"
                    :aria-pressed="thumbnailSize === option.value"
                    @click="thumbnailSize = option.value"
                  >
                    <span class="picker__size-mark" :class="`picker__size-mark--${option.value}`" aria-hidden="true" />
                    <span>{{ t(option.labelKey) }}</span>
                  </button>
                </div>
              </div>
            </div>
            <span class="picker__total">{{ t('adminPicker.imageCount', { count: sortedImages.length }) }}</span>
          </div>
          <div class="picker__grid" :style="thumbnailGridStyle">
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

  <AdminPhotoManager v-model="managerOpen" :prefix="activePrefix" />
</template>

<style scoped>
.picker {
  display: flex;
  flex-direction: column;
  height: min(80svh, 760px);
}

/* ── Source switcher ── */
.picker__sources {
  flex-shrink: 0;
  padding: 0.78rem 0.95rem;
  border-bottom: 1px solid var(--subtle);
  background: var(--body-bg);
}
.picker__source {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.picker__source > span {
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.picker__source select {
  min-height: 2.2rem;
  max-width: 24rem;
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.66rem;
  padding: 0 0.55rem;
  outline: none;
}
.picker__source select:focus { border-color: var(--accent); }

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
  align-items: center;
  justify-content: space-between;
  gap: 1.25rem;
  padding: 0.78rem 0.95rem;
  border-bottom: 1px solid var(--subtle);
  background: var(--body-bg);
}

.picker__controls {
  display: flex;
  align-items: flex-end;
  gap: 1.15rem;
  flex-wrap: wrap;
}
.picker__sort {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.picker__sort span,
.picker__size > span,
.picker__total {
  font-size: 0.48rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.picker__sort select {
  min-height: 2.2rem;
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

.picker__size {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}
.picker__size-options {
  display: flex;
  min-height: 2.2rem;
  border: 1px solid var(--subtle);
  background: #fff;
}
.picker__size-options button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.36rem;
  min-width: 4.6rem;
  border: 0;
  border-left: 1px solid var(--subtle);
  background: transparent;
  color: color-mix(in srgb, var(--muted) 88%, var(--dark));
  font-family: var(--font-sans);
  font-size: 0.55rem;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
}
.picker__size-options button:first-child {
  border-left: 0;
}
.picker__size-options button:hover {
  color: var(--dark);
  background: color-mix(in srgb, var(--paper) 48%, #fff);
}
.picker__size-options button.is-active {
  background: color-mix(in srgb, var(--accent) 7%, #fff);
  color: var(--dark);
}
.picker__size-options button.is-active::before {
  content: '';
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  height: 2px;
  background: var(--accent);
}
.picker__size-mark {
  display: block;
  flex: 0 0 auto;
  border: 1px solid currentColor;
  opacity: 0.72;
}
.picker__size-mark--small {
  width: 0.52rem;
  height: 0.42rem;
}
.picker__size-mark--medium {
  width: 0.68rem;
  height: 0.5rem;
}
.picker__size-mark--large {
  width: 0.84rem;
  height: 0.58rem;
}
.picker__size-options button.is-active .picker__size-mark {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, #fff);
  opacity: 1;
}

.picker__grid {
  --picker-thumb-height: 150px;
  --picker-thumb-max-width: 280px;
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: flex-start;
  gap: 0.45rem;
  padding: 0.75rem 0.9rem;
}

.picker__item {
  position: relative;
  height: var(--picker-thumb-height);
  overflow: hidden;
  background: var(--paper);
  border: 1px solid var(--subtle);
  cursor: pointer;
  padding: 0;
}
.picker__item img {
  height: 100%;
  width: auto;
  max-width: var(--picker-thumb-max-width);
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
  .picker__controls {
    align-items: stretch;
    flex-direction: column;
  }
  .picker__sort select {
    width: 100%;
  }
  .picker__source select {
    max-width: none;
    width: 100%;
  }
  .picker__size-options {
    width: 100%;
  }
  .picker__size-options button {
    flex: 1;
    min-width: 0;
  }
  .picker__item {
    height: min(var(--picker-thumb-height), 150px);
  }
  .picker__item img {
    max-width: min(var(--picker-thumb-max-width), 260px);
  }
}
</style>
