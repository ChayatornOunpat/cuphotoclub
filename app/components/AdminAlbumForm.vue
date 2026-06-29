<script setup lang="ts">
import { onBeforeRouteLeave } from 'vue-router'
import type { AlbumCell, AlbumRow, AlbumInput, CellType, CellSpan } from '~~/shared/types'
import AlbumEssay from '~/components/AlbumEssay.vue'
import AlbumSticky from '~/components/AlbumSticky.vue'
import AlbumContact from '~/components/AlbumContact.vue'
import { PLACEHOLDER_IMG } from '~/utils/placeholder'

const props = defineProps<{
  initial?: AlbumInput | null
  submitLabel?: string
  busy?: boolean
  error?: string | null
  saved?: boolean
}>()
const emit = defineEmits<{ submit: [value: AlbumInput] }>()
const { t } = useI18n()
const localePath = useLocalePath()

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function blank(): AlbumInput {
  return {
    title: '',
    category: '',
    date: '',
    published: todayISO(),
    location: '',
    excerpt: '',
    style: 'essay',
    placement: 'gallery',
    coverSrc: '',
    rows: []
  }
}

const form = reactive<AlbumInput>(props.initial ? structuredClone(toRaw(props.initial)) : blank())

// Editing state
const selectedRow = ref<number | null>(null)
const selectedCell = ref<number | null>(null)
const dockHidden = ref(true)
const activeDock = ref<'content' | 'cell'>('cell')
const editorEl = ref<HTMLElement | null>(null)

// Drag state
const draggingFromPalette = ref<{ type: CellType, span: CellSpan } | null>(null)
const draggingRowIndex = ref<number | null>(null)
const draggingCellInfo = ref<{ row: number, cell: number } | null>(null)
const dragOverRowIndex = ref<number | null>(null)
const dragOverCellIndex = ref<{ row: number, cell: number } | null>(null)

// Content editing refs
const activeField = ref<'title' | 'category' | 'date' | 'location' | 'excerpt'>('title')
const titleInput = ref<HTMLInputElement | null>(null)
const categoryInput = ref<HTMLInputElement | null>(null)
const dateInput = ref<HTMLInputElement | null>(null)
const locationInput = ref<HTMLInputElement | null>(null)
const excerptInput = ref<HTMLTextAreaElement | null>(null)

// Dirty tracking
const dirty = ref(false)
const initialized = ref(false)
watch(form, () => { if (initialized.value) dirty.value = true }, { deep: true })
onMounted(() => nextTick(() => { initialized.value = true }))
watch(() => props.saved, (val) => { if (val) dirty.value = false })

onBeforeRouteLeave(() => {
  if (dirty.value) return window.confirm(t('adminEditor.unsavedChanges'))
})

function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (dirty.value) e.preventDefault()
}
onMounted(() => window.addEventListener('beforeunload', handleBeforeUnload))
onUnmounted(() => window.removeEventListener('beforeunload', handleBeforeUnload))

// ARIA live region
const dockAnnouncement = ref('')
watch(activeDock, (val) => {
  dockAnnouncement.value = val === 'content' ? t('adminEditor.contentModeAria') : t('adminEditor.frameModeAria')
  setTimeout(() => { dockAnnouncement.value = '' }, 1500)
})

// Error display
const validationError = ref<string | null>(null)
const displayError = computed(() => props.error ?? validationError.value)

// Hint
const hintDismissed = ref(
  typeof sessionStorage !== 'undefined' && !!sessionStorage.getItem('cu-editor-hint-v3')
)
let hintTimer: ReturnType<typeof setTimeout>
function dismissHint() {
  hintDismissed.value = true
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('cu-editor-hint-v3', '1')
}
onMounted(() => {
  if (!hintDismissed.value) hintTimer = setTimeout(dismissHint, 7000)
})
onUnmounted(() => clearTimeout(hintTimer))

// Preview
const styles = { essay: AlbumEssay, sticky: AlbumSticky, contact: AlbumContact }
const styleComponent = computed(() => styles[form.style] ?? AlbumEssay)

const previewAlbum = computed(() => ({
  title: form.title || t('adminForm.titlePlaceholder'),
  category: form.category || t('adminForm.categoryPlaceholder'),
  date: form.date || t('adminForm.datePlaceholder'),
  location: form.location,
  excerpt: form.excerpt || t('adminForm.excerptPlaceholder'),
  coverSrc: form.coverSrc || form.rows.flatMap(r => r.cells).find(c => c.type === 'image' && c.src)?.src || '',
  rows: form.rows.map((row, ri) => ({
    cells: row.cells.map((cell, ci) => {
      if (cell.type !== 'image') return cell
      return { ...cell, src: cell.src || PLACEHOLDER_IMG }
    })
  }))
}))

// Row / cell helpers
function rowUsed(row: AlbumRow): number {
  return row.cells.reduce((s, c) => s + c.span, 0)
}

function makeCell(type: CellType, span: CellSpan): AlbumCell {
  if (type === 'text') return { type: 'text', span, content: '' }
  if (type === 'pad')  return { type: 'pad', span }
  return { type: 'image', span, src: '', caption: '' }
}

function addRow() {
  form.rows.push({ cells: [] })
  selectedRow.value = form.rows.length - 1
  selectedCell.value = null
  dockHidden.value = true
}

function removeRow(ri: number) {
  form.rows.splice(ri, 1)
  if (selectedRow.value === ri) {
    selectedRow.value = null
    selectedCell.value = null
    dockHidden.value = true
  } else if (selectedRow.value !== null && selectedRow.value > ri) {
    selectedRow.value--
  }
  if (draggingRowIndex.value === ri) draggingRowIndex.value = null
}

function addCell(ri: number, type: CellType, span: CellSpan) {
  const row = form.rows[ri]
  if (!row) return
  if (isEssay.value && rowUsed(row) + span > 6) return
  row.cells.push(makeCell(type, span))
  selectedRow.value = ri
  selectedCell.value = row.cells.length - 1
  activeDock.value = 'cell'
  dockHidden.value = false
}

function removeCell(ri: number, ci: number) {
  form.rows[ri]?.cells.splice(ci, 1)
  if (selectedRow.value === ri && selectedCell.value === ci) {
    selectedRow.value = null
    selectedCell.value = null
    dockHidden.value = true
  } else if (selectedRow.value === ri && selectedCell.value !== null && selectedCell.value > ci) {
    selectedCell.value--
  }
}

function selectCell(ri: number, ci: number) {
  selectedRow.value = ri
  selectedCell.value = ci
  activeDock.value = 'cell'
  dockHidden.value = false
}

function addCellFromPalette(type: CellType, span: CellSpan) {
  if (selectedRow.value !== null) {
    const row = form.rows[selectedRow.value]
    if (row && (!isEssay.value || rowUsed(row) + span <= 6)) {
      addCell(selectedRow.value, type, span)
      return
    }
  }
  form.rows.push({ cells: [] })
  addCell(form.rows.length - 1, type, span)
}

function setCoverFromCell(ri: number, ci: number) {
  const src = form.rows[ri]?.cells[ci]?.src
  if (src) form.coverSrc = src
}

const selectedCellData = computed(() =>
  selectedRow.value !== null && selectedCell.value !== null
    ? form.rows[selectedRow.value]?.cells[selectedCell.value] ?? null
    : null
)

function spanFits(s: CellSpan): boolean {
  if (!isEssay.value) return true
  if (selectedRow.value === null || selectedCell.value === null) return false
  const row = form.rows[selectedRow.value]
  if (!row) return false
  const current = row.cells[selectedCell.value]
  if (!current) return false
  return rowUsed(row) - current.span + s <= 6
}

function setSpan(s: CellSpan) {
  const cell = selectedCellData.value
  if (cell && spanFits(s)) cell.span = s
}

// Row drag (reorder)
function onRowDragStart(ri: number) {
  draggingRowIndex.value = ri
}
function onRowDragOver(ri: number) {
  if (draggingRowIndex.value !== null || draggingFromPalette.value !== null) {
    dragOverRowIndex.value = ri
  }
}
function onRowDrop(ri: number) {
  if (draggingRowIndex.value !== null) {
    const from = draggingRowIndex.value
    if (from !== ri) {
      const [item] = form.rows.splice(from, 1)
      form.rows.splice(ri, 0, item!)
      if (selectedRow.value === from) selectedRow.value = ri
      else if (selectedRow.value !== null) {
        if (from < selectedRow.value && ri >= selectedRow.value) selectedRow.value--
        else if (from > selectedRow.value && ri <= selectedRow.value) selectedRow.value++
      }
    }
  } else if (draggingFromPalette.value) {
    const { type, span } = draggingFromPalette.value
    const row = form.rows[ri]
    if (row && (!isEssay.value || rowUsed(row) + span <= 6)) addCell(ri, type, span)
  }
  draggingRowIndex.value = null
  draggingFromPalette.value = null
  dragOverRowIndex.value = null
}
function onRowDragEnd() {
  draggingRowIndex.value = null
  dragOverRowIndex.value = null
}

// Cell drag (reorder within row)
function onCellDragStart(ri: number, ci: number) {
  draggingCellInfo.value = { row: ri, cell: ci }
}
function onCellDragOver(ri: number, ci: number) {
  if (draggingCellInfo.value?.row === ri) {
    dragOverCellIndex.value = { row: ri, cell: ci }
  }
}
function onCellDrop(ri: number, ci: number) {
  if (draggingCellInfo.value?.row === ri) {
    const from = draggingCellInfo.value.cell
    if (from !== ci) {
      const row = form.rows[ri]!
      const [item] = row.cells.splice(from, 1)
      row.cells.splice(ci, 0, item!)
      if (selectedRow.value === ri && selectedCell.value === from) {
        selectedCell.value = ci
      } else if (selectedRow.value === ri && selectedCell.value !== null) {
        if (from < selectedCell.value && ci >= selectedCell.value) selectedCell.value--
        else if (from > selectedCell.value && ci <= selectedCell.value) selectedCell.value++
      }
    }
  }
  draggingCellInfo.value = null
  dragOverCellIndex.value = null
}
function onCellDragEnd() {
  draggingCellInfo.value = null
  dragOverCellIndex.value = null
}

// Palette drag
function onPaletteDragStart(type: CellType, span: CellSpan) {
  draggingFromPalette.value = { type, span }
}
function onPaletteDragEnd() {
  draggingFromPalette.value = null
  dragOverRowIndex.value = null
}

// Canvas drop (palette → new row at end)
// Canvas drag — pick up a cell directly from the preview
function onCanvasDragStart(e: DragEvent) {
  const cellEl = (e.target as HTMLElement).closest('[data-cell-n]') as HTMLElement | null
  if (!cellEl) { e.preventDefault(); return }
  const ri = parseInt(cellEl.getAttribute('data-row-n') || '0')
  const ci = parseInt(cellEl.getAttribute('data-cell-n') || '0')
  draggingCellInfo.value = { row: ri, cell: ci }
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${ri}:${ci}`)
    // Tiny invisible ghost so the drag doesn't carry a giant photo thumbnail
    const ghost = document.createElement('div')
    ghost.style.cssText = 'position:fixed;top:-200px;width:1px;height:1px;opacity:0'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    requestAnimationFrame(() => ghost.remove())
  }
}

function onCanvasDragEnd() {
  draggingCellInfo.value = null
  dragOverCellIndex.value = null
}

function onCanvasDragOver(e: DragEvent) {
  e.preventDefault()
  if (draggingCellInfo.value !== null) {
    const cellEl = (e.target as HTMLElement).closest('[data-cell-n]') as HTMLElement | null
    if (cellEl) {
      const ri = parseInt(cellEl.getAttribute('data-row-n') || '0')
      const ci = parseInt(cellEl.getAttribute('data-cell-n') || '0')
      dragOverCellIndex.value = { row: ri, cell: ci }
    }
  }
}

function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  if (draggingCellInfo.value !== null) {
    const cellEl = (event.target as HTMLElement).closest('[data-cell-n]') as HTMLElement | null
    if (cellEl) {
      const ri = parseInt(cellEl.getAttribute('data-row-n') || '0')
      const ci = parseInt(cellEl.getAttribute('data-cell-n') || '0')
      onCellDrop(ri, ci)
    } else {
      draggingCellInfo.value = null
      dragOverCellIndex.value = null
    }
  } else if (draggingFromPalette.value) {
    const { type, span } = draggingFromPalette.value
    // If dropped on an existing row, try to add there first
    const rowEl = (event.target as HTMLElement).closest('[data-row-n]') as HTMLElement | null
    if (rowEl) {
      const ri = parseInt(rowEl.getAttribute('data-row-n') || '0')
      const row = form.rows[ri]
      if (row && (!isEssay.value || rowUsed(row) + span <= 6)) {
        addCell(ri, type, span)
        draggingFromPalette.value = null
        return
      }
    }
    form.rows.push({ cells: [] })
    addCell(form.rows.length - 1, type, span)
    draggingFromPalette.value = null
  }
}

// Canvas click — select cell or open content dock
function onCanvasClick(event: MouseEvent) {
  const target = event.target as HTMLElement

  const cellEl = target.closest('[data-cell-n]')
  if (cellEl) {
    const ri = parseInt(cellEl.getAttribute('data-row-n') || '0')
    const ci = parseInt(cellEl.getAttribute('data-cell-n') || '0')
    selectCell(ri, ci)
    return
  }

  if (target.closest('.cover__title, .head__title, .meta__title')) {
    editContent('title', titleInput); return
  }
  if (target.closest('.cover__kicker, .head__kicker, .meta__cat')) {
    editContent('category', categoryInput); return
  }
  if (target.closest('.cover__meta, .head__kicker, .meta__facts')) {
    editContent('date', dateInput); return
  }
  if (target.closest('.intro__lead, .head__sub, .meta__excerpt')) {
    editContent('excerpt', excerptInput); return
  }

  dockHidden.value = true
}

async function focusField(field: { value: HTMLInputElement | HTMLTextAreaElement | null }) {
  await nextTick()
  field.value?.focus()
  field.value?.select()
}

function editContent(
  fieldName: typeof activeField.value,
  field: { value: HTMLInputElement | HTMLTextAreaElement | null }
) {
  dockHidden.value = false
  activeDock.value = 'content'
  activeField.value = fieldName
  void focusField(field)
}

// Submit
function onSubmit() {
  validationError.value = null
  const missing: string[] = []
  if (!form.title.trim()) missing.push(t('adminEditor.fieldTitle'))
  if (!form.category.trim()) missing.push(t('adminEditor.fieldCategory'))
  if (!form.date.trim()) missing.push(t('adminEditor.fieldDate'))
  if (!form.published) missing.push(t('adminEditor.fieldPublished'))
  if (missing.length) {
    validationError.value = t('adminEditor.validationMissing', { fields: missing.join(', ') })
    return
  }
  emit('submit', structuredClone(toRaw(form)))
}

const SPANS: CellSpan[] = [2, 3, 4, 6]
const isEssay = computed(() => form.style === 'essay')
</script>

<template>
  <form ref="editorEl" class="editor" @submit.prevent="onSubmit">
    <div class="sr-only" aria-live="assertive" aria-atomic="true">{{ dockAnnouncement }}</div>

    <!-- LEFT TRAY -->
    <aside class="tray">
      <!-- Save / Cancel row -->
      <div class="tray__topbar">
        <NuxtLink :to="localePath('/admin/albums')" class="btn-ghost">{{ t('admin.cancel') }}</NuxtLink>
        <button type="submit" class="btn-solid" :disabled="busy">
          {{ busy ? t('admin.saving') : (submitLabel || t('admin.save')) }}
        </button>
      </div>
      <p v-if="displayError" class="tray__error" role="alert">{{ displayError }}</p>

      <!-- Settings -->
      <div class="tray__section">
        <p class="tray__label">{{ t('adminEditor.layout') }}</p>
        <div class="field">
          <label>{{ t('adminForm.style') }}</label>
          <select v-model="form.style">
            <option value="essay">{{ t('adminForm.styleEssay') }}</option>
            <option value="sticky">{{ t('adminForm.styleSticky') }}</option>
            <option value="contact">{{ t('adminForm.styleContact') }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('adminForm.placement') }}</label>
          <select v-model="form.placement">
            <option value="gallery">{{ t('adminForm.placementGallery') }}</option>
            <option value="blog">{{ t('adminForm.placementBlog') }}</option>
            <option value="both">{{ t('adminForm.placementBoth') }}</option>
          </select>
        </div>
        <div class="field">
          <label>{{ t('adminForm.publishedSort') }}</label>
          <input v-model="form.published" type="date">
        </div>
        <div class="field">
          <label>Cover URL <span class="opt">auto if empty</span></label>
          <input v-model="form.coverSrc" type="text" placeholder="https://…">
        </div>
      </div>

      <!-- Palette -->
      <div class="tray__section">
        <!-- Essay: full span palette -->
        <template v-if="isEssay">
          <p class="tray__label">Image</p>
          <div class="palette">
            <button
              v-for="s in SPANS"
              :key="s"
              type="button"
              class="palette__chip palette__chip--image"
              draggable="true"
              :title="`Add image cell · span ${s}`"
              @click="addCellFromPalette('image', s)"
              @dragstart.stop="onPaletteDragStart('image', s)"
              @dragend.stop="onPaletteDragEnd"
            >
              <span class="chip__type">img</span><span class="chip__span">{{ s }}</span>
            </button>
          </div>
          <p class="tray__label tray__label--gap">Text</p>
          <div class="palette">
            <button
              v-for="s in SPANS"
              :key="s"
              type="button"
              class="palette__chip palette__chip--text"
              draggable="true"
              :title="`Add text cell · span ${s}`"
              @click="addCellFromPalette('text', s)"
              @dragstart.stop="onPaletteDragStart('text', s)"
              @dragend.stop="onPaletteDragEnd"
            >
              <span class="chip__type">txt</span><span class="chip__span">{{ s }}</span>
            </button>
          </div>
          <p class="tray__label tray__label--gap">Pad</p>
          <div class="palette">
            <button
              v-for="s in SPANS"
              :key="s"
              type="button"
              class="palette__chip palette__chip--pad"
              draggable="true"
              :title="`Add padding · span ${s}`"
              @click="addCellFromPalette('pad', s)"
              @dragstart.stop="onPaletteDragStart('pad', s)"
              @dragend.stop="onPaletteDragEnd"
            >
              <span class="chip__type">pad</span><span class="chip__span">{{ s }}</span>
            </button>
          </div>
        </template>

        <!-- Sticky / Contact: fixed layout, no spans -->
        <template v-else>
          <p class="tray__label">Add</p>
          <div class="palette palette--fixed">
            <button type="button" class="palette__chip palette__chip--image" title="Add image" @click="addCellFromPalette('image', 6)">
              <span class="chip__type">Image</span>
            </button>
            <button type="button" class="palette__chip palette__chip--text" title="Add text block" @click="addCellFromPalette('text', 6)">
              <span class="chip__type">Text</span>
            </button>
            <button type="button" class="palette__chip palette__chip--pad" title="Add spacer" @click="addCellFromPalette('pad', 6)">
              <span class="chip__type">Spacer</span>
            </button>
          </div>
        </template>
      </div>

      <!-- Row List -->
      <div class="tray__section tray__section--grow">
        <p class="tray__label">
          Rows
          <span class="tray__count">{{ form.rows.length }}</span>
        </p>

        <div
          class="row-list"
          :class="{ 'drop-active': draggingFromPalette !== null }"
          @dragover.prevent
          @drop.prevent="onRowDrop(form.rows.length)"
        >
          <div
            v-for="(row, ri) in form.rows"
            :key="ri"
            class="row-item"
            :class="{
              'is-selected': selectedRow === ri,
              'is-dragging': draggingRowIndex === ri,
              'drop-target': dragOverRowIndex === ri && dragOverRowIndex !== draggingRowIndex
            }"
            @dragover.prevent.stop="onRowDragOver(ri)"
            @drop.prevent.stop="onRowDrop(ri)"
          >
            <!-- Row header -->
            <div
              class="row-item__head"
              draggable="true"
              @dragstart.stop="onRowDragStart(ri)"
              @dragend.stop="onRowDragEnd"
            >
              <span class="row-item__drag">⠿</span>
              <span class="row-item__label">Row {{ ri + 1 }}</span>
              <span v-if="isEssay" class="row-item__usage" :class="{ full: rowUsed(row) >= 6 }">{{ rowUsed(row) }}/6</span>
              <button
                type="button"
                class="row-item__del"
                :aria-label="`Remove row ${ri + 1}`"
                @click.stop="removeRow(ri)"
              >×</button>
            </div>

            <!-- Cell chips -->
            <div class="row-item__cells" :class="{ 'mode-fixed': !isEssay }">
              <div
                v-for="(cell, ci) in row.cells"
                :key="ci"
                class="cell-chip"
                :style="`--span: ${cell.span}`"
                :class="{
                  'cell-chip--image': cell.type === 'image',
                  'cell-chip--text': cell.type === 'text',
                  'cell-chip--pad': cell.type === 'pad',
                  'is-selected': selectedRow === ri && selectedCell === ci,
                  'is-dragging': draggingCellInfo?.row === ri && draggingCellInfo?.cell === ci,
                  'drop-target': dragOverCellIndex?.row === ri && dragOverCellIndex?.cell === ci
                }"
                draggable="true"
                @click.stop="selectCell(ri, ci)"
                @dragstart.stop="onCellDragStart(ri, ci)"
                @dragover.prevent.stop="onCellDragOver(ri, ci)"
                @drop.prevent.stop="onCellDrop(ri, ci)"
                @dragend.stop="onCellDragEnd"
              >
                <span class="cell-chip__label">{{ cell.type === 'image' ? 'img' : cell.type }} {{ cell.span }}</span>
                <button
                  type="button"
                  class="cell-chip__del"
                  aria-label="Remove cell"
                  @click.stop="removeCell(ri, ci)"
                >×</button>
              </div>
              <div v-if="row.cells.length === 0" class="row-item__empty" style="grid-column: 1 / -1">drop cells here</div>
            </div>
          </div>

          <div v-if="form.rows.length === 0" class="row-list__empty">
            Click palette chips or drag here
          </div>
        </div>

        <button type="button" class="row-add-btn" @click="addRow">+ New Row</button>
      </div>
    </aside>

    <!-- RIGHT CANVAS -->
    <section
      class="canvas"
      :class="{ 'canvas--drop': draggingFromPalette !== null }"
      @click.capture="onCanvasClick"
      @dragstart.capture="onCanvasDragStart"
      @dragend.capture="onCanvasDragEnd"
      @dragover="onCanvasDragOver"
      @drop.prevent="onCanvasDrop"
    >
      <Transition name="hint">
        <div v-if="!hintDismissed" class="canvas-hint" role="status">
          <span>{{ t('adminEditor.canvasHint') }}</span>
          <button type="button" class="canvas-hint__dismiss" @click="dismissHint">{{ t('adminEditor.canvasHintDismiss') }}</button>
        </div>
      </Transition>

      <div v-if="draggingFromPalette" class="canvas-drop-zone">
        <span>Drop to add as new row</span>
      </div>

      <component
        :is="styleComponent"
        :album="previewAlbum"
        disable-navigation
        :selected-row="selectedRow ?? undefined"
        :selected-cell="selectedCell ?? undefined"
        :draggable-cells="true"
      />
    </section>

    <!-- FLOATING DOCK — Content (title / meta) -->
    <section v-show="!dockHidden && activeDock === 'content'" class="context-dock content-dock" aria-live="polite">
      <div class="dock-fields">
        <div class="field field--title" :class="{ active: activeField === 'title' }">
          <label>{{ t('adminForm.title') }}</label>
          <input ref="titleInput" v-model="form.title" type="text" :placeholder="t('adminForm.titlePlaceholder')" @focus="activeField = 'title'">
        </div>
        <div class="field" :class="{ active: activeField === 'category' }">
          <label>{{ t('adminForm.category') }}</label>
          <input ref="categoryInput" v-model="form.category" type="text" :placeholder="t('adminForm.categoryPlaceholder')" @focus="activeField = 'category'">
        </div>
        <div class="field" :class="{ active: activeField === 'date' }">
          <label>{{ t('adminForm.dateDisplay') }}</label>
          <input ref="dateInput" v-model="form.date" type="text" :placeholder="t('adminForm.datePlaceholder')" @focus="activeField = 'date'">
        </div>
        <div class="field" :class="{ active: activeField === 'location' }">
          <label>{{ t('adminForm.location') }} <span class="opt">{{ t('adminForm.locationOptional') }}</span></label>
          <input ref="locationInput" v-model="form.location" type="text" :placeholder="t('adminForm.locationPlaceholder')" @focus="activeField = 'location'">
        </div>
        <div class="field field--excerpt" :class="{ active: activeField === 'excerpt' }">
          <label>{{ t('adminForm.excerpt') }}</label>
          <textarea ref="excerptInput" v-model="form.excerpt" rows="2" :placeholder="t('adminForm.excerptPlaceholder')" @focus="activeField = 'excerpt'" />
        </div>
      </div>
    </section>

    <!-- FLOATING DOCK — Cell editor -->
    <section
      v-show="!dockHidden && activeDock === 'cell' && selectedCellData"
      class="context-dock block-dock"
      aria-live="polite"
    >
      <div class="block-dock__head">
        <h2>
          Row {{ (selectedRow ?? 0) + 1 }}, Cell {{ (selectedCell ?? 0) + 1 }}
          <span class="block-dock__type">{{ selectedCellData?.type }}</span>
        </h2>
        <div v-if="isEssay" class="span-selector">
          <button
            v-for="s in SPANS"
            :key="s"
            type="button"
            class="span-btn"
            :class="{ active: selectedCellData?.span === s, disabled: !spanFits(s) }"
            :title="`Span ${s}`"
            @click="setSpan(s)"
          >{{ s }}</button>
        </div>
        <div class="button-row">
          <button
            v-if="selectedCellData?.type === 'image'"
            type="button"
            class="btn-ghost"
            @click="setCoverFromCell(selectedRow!, selectedCell!)"
          >Set as Cover</button>
          <button type="button" class="btn-ghost danger" @click="removeCell(selectedRow!, selectedCell!)">
            {{ t('admin.delete') }}
          </button>
        </div>
      </div>

      <!-- Image cell fields -->
      <div v-if="selectedCellData?.type === 'image'" class="dock-fields image-fields">
        <div class="field">
          <label>Image URL</label>
          <input v-model="selectedCellData.src" type="text" :placeholder="t('adminForm.imageUrlPlaceholder')">
        </div>
        <div class="field">
          <label>Caption <span class="opt">optional</span></label>
          <input v-model="selectedCellData.caption" type="text" :placeholder="t('adminForm.captionPlaceholder')">
        </div>
      </div>

      <!-- Text cell field -->
      <div v-else-if="selectedCellData?.type === 'text'" class="dock-fields">
        <div class="field field--text-content">
          <label>Text Content</label>
          <textarea v-model="selectedCellData.content" rows="3" placeholder="Write your paragraph…" />
        </div>
      </div>
    </section>
  </form>
</template>

<style scoped>
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

/* ─── Root layout ─── */
.editor {
  display: flex;
  align-items: flex-start;
  min-height: calc(100vh - 3.5rem);
  background: var(--body-bg);
}

/* ─── Left tray ─── */
.tray {
  width: 230px;
  flex-shrink: 0;
  position: sticky;
  top: 3.5rem;
  height: calc(100vh - 3.5rem);
  overflow-y: auto;
  scrollbar-width: none;
  border-right: 1px solid var(--subtle);
  display: flex;
  flex-direction: column;
  background: color-mix(in srgb, var(--body-bg) 96%, white);
}
.tray::-webkit-scrollbar { display: none; }

.tray__topbar {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.65rem 0.75rem;
  border-bottom: 1px solid var(--subtle);
  background: var(--body-bg);
  position: sticky;
  top: 0;
  z-index: 2;
}
.tray__error {
  font-size: 0.56rem;
  letter-spacing: 0.06em;
  color: #b0243c;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--subtle);
}

.tray__section {
  padding: 0.75rem 0.75rem 0.5rem;
  border-bottom: 1px solid var(--subtle);
}
.tray__section--grow { flex: 1; border-bottom: none; display: flex; flex-direction: column; }

.tray__label {
  font-size: 0.44rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.45rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.tray__label--gap { margin-top: 0.6rem; }
.tray__count {
  font-size: 0.44rem;
  background: var(--accent);
  color: #fff;
  padding: 0.1rem 0.4rem;
  letter-spacing: 0;
}

/* Palette */
.palette {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.25rem;
}
.palette--fixed {
  grid-template-columns: repeat(3, 1fr);
}
.palette__chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.4rem 0.2rem;
  border: 1px solid var(--subtle);
  background: var(--body-bg);
  cursor: grab;
  transition: border-color 0.15s, background 0.15s;
}
.palette__chip--image { border-color: color-mix(in srgb, var(--accent) 30%, var(--subtle)); }
.palette__chip--text  { border-color: color-mix(in srgb, #6b7fd4 30%, var(--subtle)); }
.palette__chip--pad   { border-color: var(--subtle); border-style: dashed; }
.palette__chip:hover { background: #fff; }
.palette__chip--image:hover { border-color: var(--accent); }
.palette__chip--text:hover  { border-color: #6b7fd4; }
.palette__chip--pad:hover   { border-color: var(--muted); border-style: solid; }
.chip__type { font-size: 0.38rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.chip__span { font-size: 0.7rem; font-weight: 500; line-height: 1; color: var(--dark); }
.palette__chip--image .chip__span { color: var(--accent); }
.palette__chip--text  .chip__span { color: #6b7fd4; }
.palette__chip--pad   .chip__span { color: var(--muted); }

/* Row list */
.row-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.1rem 0;
  min-height: 3rem;
  border: 1px dashed transparent;
  transition: border-color 0.15s;
  overflow-y: auto;
  scrollbar-width: none;
}
.row-list::-webkit-scrollbar { display: none; }
.row-list.drop-active { border-color: var(--accent); }

.row-item {
  border: 1px solid var(--subtle);
  background: var(--body-bg);
  transition: border-color 0.15s;
}
.row-item.is-selected { border-color: var(--accent); }
.row-item.is-dragging { opacity: 0.4; }
.row-item.drop-target { border-top: 2px solid var(--accent); }

.row-item__head {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.4rem;
  border-bottom: 1px solid var(--subtle);
  cursor: grab;
  user-select: none;
}
.row-item__drag { color: var(--muted); font-size: 0.7rem; flex-shrink: 0; }
.row-item__label { font-size: 0.46rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--dark); flex: 1; }
.row-item__usage { font-size: 0.42rem; letter-spacing: 0.06em; color: var(--muted); }
.row-item__usage.full { color: var(--accent); }
.row-item__del {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0 0.1rem;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}
.row-item:hover .row-item__del { opacity: 1; }
.row-item__del:hover { color: #b0243c; }

.row-item__cells {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 0.15rem;
  padding: 0.3rem 0.4rem;
  min-height: 1.8rem;
  align-items: stretch;
}
.row-item__cells.mode-fixed {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
}
.row-item__cells.mode-fixed .cell-chip {
  grid-column: unset;
  flex: 0 0 auto;
}
.row-item__empty {
  font-size: 0.42rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  align-self: center;
  opacity: 0.6;
}

/* Cell chips — proportional to their span in a 6-column mini-grid */
.cell-chip {
  grid-column: span var(--span);
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.3rem;
  border: 1px solid var(--subtle);
  background: #fff;
  cursor: pointer;
  transition: border-color 0.15s;
  min-width: 0;
  overflow: hidden;
}
.cell-chip--image { border-color: color-mix(in srgb, var(--accent) 40%, var(--subtle)); }
.cell-chip--text  { border-color: color-mix(in srgb, #6b7fd4 40%, var(--subtle)); }
.cell-chip--pad   { border-color: var(--subtle); border-style: dashed; background: transparent; }
.cell-chip.is-selected { background: color-mix(in srgb, var(--accent) 8%, white); }
.cell-chip--image.is-selected { border-color: var(--accent); }
.cell-chip--text.is-selected  { border-color: #6b7fd4; }
.cell-chip--pad.is-selected   { border-color: var(--muted); border-style: solid; }
.cell-chip.is-dragging { opacity: 0.4; }
.cell-chip.drop-target { border-left: 2px solid var(--accent); }
.cell-chip__label { font-size: 0.44rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
.cell-chip--pad .cell-chip__label { color: var(--muted); }
.cell-chip__del {
  background: none;
  border: none;
  color: var(--muted);
  font-size: 0.7rem;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}
.cell-chip:hover .cell-chip__del { opacity: 1; }
.cell-chip__del:hover { color: #b0243c; }

.row-list__empty {
  font-size: 0.52rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: center;
  padding: 1.5rem 0.5rem;
  border: 1px dashed var(--subtle);
}

.row-add-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem;
  border: 1px dashed var(--subtle);
  background: none;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  flex-shrink: 0;
}
.row-add-btn:hover { border-color: var(--accent); color: var(--accent); }

/* ─── Right canvas ─── */
.canvas {
  flex: 1;
  min-width: 0;
  position: relative;
}
.canvas :deep(img) { cursor: pointer; -webkit-user-drag: none; }
.canvas :deep([draggable="true"]) { cursor: grab; }
.canvas :deep([draggable="true"]:active) { cursor: grabbing; }
.canvas :deep(.is-admin-selected) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Editable text zones */
.canvas :deep(.cover__title),
.canvas :deep(.head__title),
.canvas :deep(.meta__title),
.canvas :deep(.cover__kicker),
.canvas :deep(.meta__cat),
.canvas :deep(.cover__meta),
.canvas :deep(.meta__facts),
.canvas :deep(.intro__lead),
.canvas :deep(.head__sub),
.canvas :deep(.meta__excerpt) { cursor: pointer; }

.canvas :deep(.cover__title):hover,
.canvas :deep(.head__title):hover,
.canvas :deep(.meta__title):hover,
.canvas :deep(.cover__kicker):hover,
.canvas :deep(.meta__cat):hover,
.canvas :deep(.cover__meta):hover,
.canvas :deep(.meta__facts):hover,
.canvas :deep(.intro__lead):hover,
.canvas :deep(.head__sub):hover,
.canvas :deep(.meta__excerpt):hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.canvas-drop-zone {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 3.5rem;
  background: color-mix(in srgb, var(--accent) 12%, white);
  border-top: 2px dashed var(--accent);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  pointer-events: none;
}

.canvas-hint {
  position: absolute;
  top: 0.75rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.9rem;
  background: var(--dark);
  color: #F5F4F0;
  padding: 0.45rem 0.75rem 0.45rem 0.9rem;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  white-space: nowrap;
  box-shadow: 0 4px 16px rgba(12, 12, 10, 0.22);
}
.canvas-hint__dismiss {
  background: none;
  border: none;
  color: var(--accent);
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  cursor: pointer;
  padding: 0;
}
.canvas-hint__dismiss:hover { opacity: 0.75; }
.hint-enter-active, .hint-leave-active { transition: opacity 0.3s ease, transform 0.3s ease; }
.hint-enter-from, .hint-leave-to { opacity: 0; transform: translateX(-50%) translateY(-6px); }

/* ─── Floating dock ─── */
.context-dock {
  position: fixed;
  left: 50%;
  bottom: 0.75rem;
  transform: translateX(-50%);
  width: min(860px, calc(100vw - 14rem));
  z-index: 60;
  border: 1px solid rgba(255, 255, 255, 0.55);
  padding: 0.55rem 0.7rem;
  background: rgba(245, 244, 240, 0.65);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  box-shadow: 0 8px 32px rgba(26, 25, 24, 0.1), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

/* Content dock */
.content-dock .dock-fields {
  display: grid;
  grid-template-columns: minmax(180px, 1.4fr) repeat(3, minmax(100px, 0.75fr));
  gap: 0.5rem;
  align-items: end;
}
.content-dock .field--excerpt { grid-column: 1 / -1; }
.content-dock .field.active label { color: var(--accent); }
.content-dock .field.active textarea { max-height: 8rem; resize: none; }

/* Cell dock */
.block-dock__head {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}
.block-dock__head h2 {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-weight: 300;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}
.block-dock__type {
  font-family: var(--font-sans);
  font-size: 0.48rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--subtle);
  padding: 0.15rem 0.4rem;
}

/* Span selector */
.span-selector {
  display: flex;
  gap: 0.2rem;
}
.span-btn {
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.08em;
  padding: 0.3rem 0.5rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  line-height: 1;
}
.span-btn:hover { border-color: var(--accent); color: var(--accent); }
.span-btn.active { background: var(--accent); border-color: var(--accent); color: #fff; }
.span-btn.disabled { opacity: 0.35; cursor: not-allowed; }
.span-btn.disabled:hover { border-color: var(--subtle); color: var(--muted); }

.image-fields { grid-template-columns: 1fr 1fr; }

/* Fields shared */
.dock-fields { display: grid; gap: 0.5rem; }
.field { display: flex; flex-direction: column; gap: 0.28rem; }
.field label { font-size: 0.46rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); }
.field input, .field select, .field textarea {
  width: 100%; border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.72rem; padding: 0.38rem 0.5rem; outline: none; min-height: 2rem;
}
.field textarea { max-height: 2rem; resize: none; }
.context-dock .field.active textarea { max-height: 8rem; }
.field--text-content textarea { max-height: 5rem; }
.field :is(input, select, textarea):focus { border-color: var(--accent); }
.opt { font-size: 0.4rem; color: var(--muted); letter-spacing: 0.06em; text-transform: none; }

/* Buttons */
.button-row { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-left: auto; }
.btn-ghost, .btn-solid {
  font-family: var(--font-sans); font-size: 0.52rem; letter-spacing: 0.16em;
  text-transform: uppercase; padding: 0.55rem 0.9rem; cursor: pointer; text-decoration: none;
  white-space: nowrap;
}
.btn-ghost { border: 1px solid var(--subtle); background: none; color: var(--dark); }
.btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
.btn-ghost.danger { color: var(--muted); }
.btn-ghost.danger:hover { border-color: #b0243c; color: #b0243c; }
.btn-solid { background: var(--dark); color: #F5F4F0; border: none; flex: 1; text-align: center; }
.btn-solid:hover:not(:disabled) { background: var(--accent); }
.btn-solid:disabled { opacity: 0.6; cursor: default; }

/* Tray-level fields */
.tray .field { margin-bottom: 0.55rem; }
.tray .field label {
  font-size: 0.44rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.2rem;
}
.tray .field input, .tray .field select {
  width: 100%; border: 1px solid var(--subtle); background: #fff; color: var(--dark);
  font-family: var(--font-sans); font-size: 0.72rem; padding: 0.35rem 0.45rem; outline: none;
}
.tray .field :is(input, select):focus { border-color: var(--accent); }
</style>
