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

const libraryKeys = ref<string[]>([])
const loading = ref(false)
const selected = ref(new Set<string>())
const managerOpen = ref(false)

async function loadLibrary() {
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
  if (!val) return
  selected.value = new Set()
  loadLibrary()
})

watch(managerOpen, val => {
  if (!val) loadLibrary()
})

function toggleItem(key: string) {
  if (!props.multiple) {
    emit('select', [key])
    open.value = false
    return
  }
  const next = new Set(selected.value)
  next.has(key) ? next.delete(key) : next.add(key)
  selected.value = next
}

function confirm() {
  emit('select', [...selected.value])
  open.value = false
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
        <p v-else-if="!libraryKeys.length" class="picker__empty">
          {{ t('adminPicker.empty') }}
        </p>
        <div v-else class="picker__grid">
          <button
            v-for="key in libraryKeys"
            :key="key"
            type="button"
            class="picker__item"
            :class="{ 'is-selected': selected.has(key) }"
            @click="toggleItem(key)"
          >
            <img :src="`/images/${key}`" alt="" loading="lazy">
            <span v-if="selected.has(key)" class="picker__check" aria-hidden="true">
              <Icon name="heroicons:check" />
            </span>
          </button>
        </div>
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

.picker__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1px;
  background: var(--subtle);
  padding: 1px;
}

.picker__item {
  position: relative;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--paper);
  border: none;
  cursor: pointer;
  padding: 0;
}
.picker__item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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

.picker__check {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  width: 1.4rem;
  height: 1.4rem;
  background: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 0.75rem;
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
</style>
