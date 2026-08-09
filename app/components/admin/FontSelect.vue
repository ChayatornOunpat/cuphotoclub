<script setup lang="ts">
/**
 * Font dropdown for the album editor — album-wide default and per-cell override.
 *
 * Every option is set in the face it names, so the list is the specimen sheet;
 * Thai families get a Thai word next to the family name because their Latin
 * glyphs say nothing about how Thai copy will actually look.
 *
 * The panel is teleported to <body> and positioned against the trigger's
 * viewport rect. Both callers sit inside clipping containers (the editor tray
 * scrolls, the cell dock is a floating bar), so an absolutely positioned panel
 * would be cut off in one of them.
 */
import { ALBUM_FONTS, ALBUM_FONT_GROUPS, DEFAULT_ALBUM_FONT, albumFontClass } from '~~/shared/albumFonts'
import type { AlbumFontGroup } from '~~/shared/albumFonts'
import type { TextFont } from '~~/shared/types'

/** `auto` = inherit the album default. Only offered for per-cell overrides. */
const AUTO = 'auto'

const props = withDefaults(defineProps<{
  modelValue: TextFont | typeof AUTO
  /** Adds the leading "Auto" row, for cells that can inherit. */
  allowAuto?: boolean
  /** Face the Auto row previews in — the album default it would inherit. */
  inheritedFont?: TextFont
  label?: string
}>(), {
  allowAuto: false,
  inheritedFont: DEFAULT_ALBUM_FONT,
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [TextFont | typeof AUTO] }>()

const { t } = useI18n()

const GROUP_LABEL_KEYS: Record<AlbumFontGroup, string> = {
  editorial: 'adminForm.fontGroupEditorial',
  thai: 'adminForm.fontGroupThai',
  latin: 'adminForm.fontGroupLatin',
  system: 'adminForm.fontGroupSystem'
}

type Row = {
  value: TextFont | typeof AUTO
  label: string
  /** Class that sets the row in its own face. */
  face: string
  specimen: string
  group: AlbumFontGroup | 'auto'
}

const uid = useId()
const panelId = `${uid}-panel`
const open = ref(false)
const query = ref('')
const highlighted = ref(0)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const search = ref<HTMLInputElement | null>(null)
const rowEls = ref<HTMLButtonElement[]>([])
const anchor = reactive({ top: 0, left: 0, width: 0, flipped: false })

function labelFor(font: typeof ALBUM_FONTS[number]): string {
  return font.labelKey ? t(font.labelKey) : (font.label ?? font.value)
}

const allRows = computed<Row[]>(() => {
  const rows: Row[] = ALBUM_FONTS.map(font => ({
    value: font.value,
    label: labelFor(font),
    face: albumFontClass(font.value),
    // The family name alone is Latin, which tells an editor nothing about a
    // Thai face — so Thai-script entries carry a Thai word too.
    specimen: font.script === 'thai' ? 'ภาพถ่าย' : 'Aa',
    group: font.group
  }))
  if (!props.allowAuto) return rows
  return [{
    value: AUTO,
    label: t('adminForm.cellFontAuto'),
    face: albumFontClass(props.inheritedFont),
    specimen: '',
    group: 'auto'
  }, ...rows]
})

const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return allRows.value
  return allRows.value.filter(row => row.label.toLowerCase().includes(q) || row.value.includes(q))
})

/**
 * Rows grouped for display, in the catalogue's own order. Each entry carries
 * its index in `visible` so keyboard highlighting stays one flat sequence
 * across the group headings.
 */
const sections = computed(() => {
  const order: (AlbumFontGroup | 'auto')[] = ['auto', ...ALBUM_FONT_GROUPS]
  const indexed = visible.value.map((row, index) => ({ row, index }))
  return order
    .map(group => ({
      group,
      // No heading over the Auto row — it reads as a mode, not a category.
      heading: group === 'auto' ? '' : t(GROUP_LABEL_KEYS[group as AlbumFontGroup]),
      entries: indexed.filter(entry => entry.row.group === group)
    }))
    .filter(section => section.entries.length > 0)
})

const current = computed(() => allRows.value.find(row => row.value === props.modelValue) ?? allRows.value[0]!)

function place() {
  const rect = trigger.value?.getBoundingClientRect()
  if (!rect) return
  const panelHeight = Math.min(360, window.innerHeight - 32)
  const below = window.innerHeight - rect.bottom
  anchor.flipped = below < panelHeight && rect.top > below
  anchor.top = anchor.flipped ? Math.max(8, rect.top - panelHeight - 4) : rect.bottom + 4
  anchor.left = Math.min(rect.left, Math.max(8, window.innerWidth - Math.max(rect.width, 232) - 8))
  anchor.width = Math.max(rect.width, 232)
}

function openPanel() {
  if (open.value) return
  open.value = true
  query.value = ''
  highlighted.value = Math.max(visible.value.findIndex(row => row.value === props.modelValue), 0)
  place()
  nextTick(() => {
    search.value?.focus()
    scrollHighlightedIntoView()
  })
}

function closePanel(returnFocus = false) {
  if (!open.value) return
  open.value = false
  rowEls.value = []
  if (returnFocus) trigger.value?.focus()
}

function choose(row: Row) {
  emit('update:modelValue', row.value)
  closePanel(true)
}

function setRowRef(el: unknown, index: number) {
  if (el instanceof HTMLButtonElement) rowEls.value[index] = el
}

function scrollHighlightedIntoView() {
  rowEls.value[highlighted.value]?.scrollIntoView({ block: 'nearest' })
}

function move(delta: number) {
  const count = visible.value.length
  if (!count) return
  highlighted.value = ((highlighted.value + delta) % count + count) % count
  nextTick(scrollHighlightedIntoView)
}

function onKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closePanel(true)
      break
    case 'ArrowDown':
      event.preventDefault()
      move(1)
      break
    case 'ArrowUp':
      event.preventDefault()
      move(-1)
      break
    case 'Home':
      event.preventDefault()
      highlighted.value = 0
      nextTick(scrollHighlightedIntoView)
      break
    case 'End':
      event.preventDefault()
      highlighted.value = visible.value.length - 1
      nextTick(scrollHighlightedIntoView)
      break
    case 'Enter': {
      event.preventDefault()
      const row = visible.value[highlighted.value]
      if (row) choose(row)
      break
    }
    case 'Tab':
      closePanel()
      break
  }
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    openPanel()
  }
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) return
  const target = event.target as Node
  if (trigger.value?.contains(target) || panel.value?.contains(target)) return
  closePanel()
}

// Any ancestor scroll moves the trigger out from under a fixed panel, so the
// listener is capturing — scroll doesn't bubble.
function onViewportChange() {
  if (open.value) place()
}

// Filtering can leave the highlight past the end of the list.
watch(visible, rows => {
  if (highlighted.value >= rows.length) highlighted.value = Math.max(rows.length - 1, 0)
})

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('scroll', onViewportChange, true)
  window.addEventListener('resize', onViewportChange)
})
onBeforeUnmount(() => {
  if (!import.meta.client) return
  document.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('scroll', onViewportChange, true)
  window.removeEventListener('resize', onViewportChange)
})
</script>

<template>
  <div class="fontsel">
    <button
      ref="trigger"
      type="button"
      class="fontsel__trigger"
      :class="{ 'is-open': open }"
      :aria-expanded="open"
      :aria-controls="open ? panelId : undefined"
      :aria-label="label || undefined"
      aria-haspopup="listbox"
      @click="open ? closePanel() : openPanel()"
      @keydown="onTriggerKeydown"
    >
      <span class="fontsel__name" :class="current.face">{{ current.label }}</span>
      <span class="fontsel__chevron" aria-hidden="true" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        :id="panelId"
        ref="panel"
        class="fontsel__panel"
        :style="{ top: `${anchor.top}px`, left: `${anchor.left}px`, width: `${anchor.width}px` }"
        @keydown="onKeydown"
      >
        <div class="fontsel__search">
          <input
            ref="search"
            v-model="query"
            type="search"
            class="fontsel__field"
            :placeholder="t('adminForm.fontSearch')"
            :aria-label="t('adminForm.fontSearch')"
            autocomplete="off"
          >
        </div>

        <div class="fontsel__list" role="listbox" :aria-label="label || undefined">
          <template v-for="section in sections" :key="section.group">
            <p v-if="section.heading" class="fontsel__group">{{ section.heading }}</p>
            <button
              v-for="entry in section.entries"
              :key="entry.row.value"
              :ref="el => setRowRef(el, entry.index)"
              type="button"
              role="option"
              class="fontsel__option"
              :class="{
                'is-active': entry.row.value === modelValue,
                'is-highlighted': entry.index === highlighted
              }"
              :aria-selected="entry.row.value === modelValue"
              @click="choose(entry.row)"
              @mousemove="highlighted = entry.index"
            >
              <span class="fontsel__option-name" :class="entry.row.face">{{ entry.row.label }}</span>
              <span v-if="entry.row.specimen" class="fontsel__specimen" :class="entry.row.face" aria-hidden="true">{{ entry.row.specimen }}</span>
            </button>
          </template>
          <p v-if="!visible.length" class="fontsel__empty">{{ t('adminForm.fontNone') }}</p>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped src="~/assets/css/album-fonts.css"></style>

<style scoped>
.fontsel { min-width: 0; }

.fontsel__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem;
  width: 100%;
  min-height: 2.15rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--dark);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, color 0.15s;
}
.fontsel__trigger:hover,
.fontsel__trigger.is-open { border-color: var(--accent); }
.fontsel__trigger:focus-visible { outline: none; border-color: var(--accent); }

.fontsel__name {
  font-size: 0.78rem;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fontsel__chevron {
  flex-shrink: 0;
  width: 0.36rem;
  height: 0.36rem;
  border-right: 1px solid var(--muted);
  border-bottom: 1px solid var(--muted);
  transform: translateY(-25%) rotate(45deg);
  transition: transform 0.15s;
}
.fontsel__trigger.is-open .fontsel__chevron { transform: translateY(10%) rotate(-135deg); }

/* Teleported to <body>, so nothing here can inherit the editor's context. */
.fontsel__panel {
  position: fixed;
  z-index: 1200;
  display: flex;
  flex-direction: column;
  max-height: min(360px, calc(100vh - 32px));
  border: 1px solid var(--subtle);
  border-top: 2px solid var(--accent);
  background: #fff;
  box-shadow: 0 1rem 2.5rem rgba(26, 25, 24, 0.18);
}

.fontsel__search {
  flex-shrink: 0;
  padding: 0.45rem 0.55rem;
  border-bottom: 1px solid var(--subtle);
}
.fontsel__field {
  width: 100%;
  border: none;
  background: none;
  outline: none;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--dark);
}
.fontsel__field::placeholder {
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
}
.fontsel__field::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }

.fontsel__list { overflow-y: auto; padding-bottom: 0.25rem; }

.fontsel__group {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.5rem 0.55rem 0.28rem;
  background: #fff;
  font-family: var(--font-sans);
  font-size: 0.42rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  border-bottom: 1px solid var(--subtle);
}

.fontsel__option {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.6rem;
  width: 100%;
  padding: 0.42rem 0.55rem;
  border: none;
  background: none;
  cursor: pointer;
  text-align: left;
  color: var(--dark);
  transition: background 0.1s, color 0.1s;
}
.fontsel__option-name {
  font-size: 0.86rem;
  line-height: 1.25;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.fontsel__specimen {
  flex-shrink: 0;
  font-size: 0.86rem;
  line-height: 1.25;
  color: var(--muted);
}
.fontsel__option:focus-visible { outline: none; }
.fontsel__option.is-highlighted { background: color-mix(in srgb, var(--dark) 5%, transparent); }
.fontsel__option.is-active { color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, transparent); }
.fontsel__option.is-active .fontsel__specimen { color: var(--accent); }

.fontsel__empty {
  margin: 0;
  padding: 1rem 0.55rem;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  color: var(--muted);
  text-align: center;
}

@media (prefers-reduced-motion: reduce) {
  .fontsel__trigger,
  .fontsel__chevron,
  .fontsel__option { transition-duration: 0.01ms !important; }
}
</style>
