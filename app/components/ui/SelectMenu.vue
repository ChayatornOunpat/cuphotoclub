<script setup lang="ts">
/**
 * Editorial single-select dropdown with type-to-filter.
 *
 * Same component at every breakpoint: on wide screens the panel is a popover
 * anchored to the trigger, on narrow screens it stretches to the trigger's full
 * width and lays the options out in two columns so long lists still fit without
 * scrolling. Sharp corners, 2px accent top rule — matches the site's popover
 * language.
 *
 * All copy is passed in by the caller so every string stays inside i18n.
 */
export type SelectMenuOption = {
  value: string
  label: string
  count?: number
  lang?: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectMenuOption[]
  /** Trigger text when the current value matches no option. */
  placeholder?: string
  label?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Value that counts as "nothing chosen", so the trigger stays neutral. */
  neutralValue?: string
  /**
   * Trigger appearance on wide screens: `inline` is a bare text label that sits
   * in a row of links/chips, `field` is a bordered control. Narrow screens
   * always render the bordered form for a tappable target.
   */
  variant?: 'inline' | 'field'
  /** Hide the filter field for short lists. */
  searchable?: boolean
  /** Panel edge to pin to the trigger on wide screens. */
  align?: 'start' | 'end'
  /** Show the filter field only once the list is at least this long. */
  searchThreshold?: number
}>(), {
  placeholder: '',
  label: '',
  searchPlaceholder: '',
  emptyText: '',
  neutralValue: '',
  variant: 'inline',
  searchable: true,
  align: 'end',
  searchThreshold: 8
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const uid = useId()
const panelId = `${uid}-panel`
const open = ref(false)
const query = ref('')
const highlighted = ref(-1)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const field = ref<HTMLInputElement | null>(null)
const optionRefs = ref<HTMLButtonElement[]>([])

const selected = computed(() => props.options.find(option => option.value === props.modelValue) ?? null)
const isChosen = computed(() => Boolean(selected.value) && props.modelValue !== props.neutralValue)
// Neutral trigger keeps the generic label and reports how many choices exist;
// once something is picked it takes that option's own name and count.
const triggerLabel = computed(() => (isChosen.value ? selected.value!.label : props.placeholder || selected.value?.label || ''))
const triggerLang = computed(() => (isChosen.value ? selected.value?.lang : undefined))
const triggerCount = computed(() => (
  isChosen.value
    ? selected.value?.count
    : props.options.filter(option => option.value !== props.neutralValue).length
))
const showSearch = computed(() => props.searchable && props.options.length >= props.searchThreshold)
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.options
  return props.options.filter(option => option.label.toLowerCase().includes(q))
})

function setOptionRef(el: unknown, index: number) {
  if (el instanceof HTMLButtonElement) optionRefs.value[index] = el
}

function openPanel() {
  if (open.value) return
  open.value = true
  highlighted.value = visible.value.findIndex(option => option.value === props.modelValue)
  nextTick(() => {
    if (showSearch.value) field.value?.focus()
    else focusOption(Math.max(highlighted.value, 0))
  })
}

function closePanel(returnFocus = false) {
  if (!open.value) return
  open.value = false
  query.value = ''
  highlighted.value = -1
  optionRefs.value = []
  if (returnFocus) trigger.value?.focus()
}

function focusOption(index: number) {
  const count = visible.value.length
  if (!count) return
  const next = ((index % count) + count) % count
  highlighted.value = next
  nextTick(() => optionRefs.value[next]?.focus())
}

function choose(option: SelectMenuOption) {
  emit('update:modelValue', option.value)
  closePanel(true)
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    openPanel()
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  switch (event.key) {
    case 'Escape':
      event.preventDefault()
      closePanel(true)
      break
    case 'ArrowDown':
      event.preventDefault()
      focusOption(highlighted.value + 1)
      break
    case 'ArrowUp':
      event.preventDefault()
      focusOption(highlighted.value - 1)
      break
    case 'Home':
      event.preventDefault()
      focusOption(0)
      break
    case 'End':
      event.preventDefault()
      focusOption(visible.value.length - 1)
      break
    case 'Enter':
      if (event.target === field.value) {
        event.preventDefault()
        const option = visible.value[highlighted.value] ?? visible.value[0]
        if (option) choose(option)
      }
      break
    case 'Tab':
      closePanel()
      break
  }
}

function onPointerDown(event: PointerEvent) {
  if (!open.value) return
  if (!root.value?.contains(event.target as Node)) closePanel()
}

watch(visible, () => {
  // Keep the highlight on a row that still exists after filtering.
  if (highlighted.value >= visible.value.length) highlighted.value = visible.value.length - 1
})

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => {
  if (import.meta.client) document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<template>
  <div ref="root" class="sel" :class="[`sel--${align}`, `sel--${variant}`, { 'sel--open': open }]">
    <button
      ref="trigger"
      type="button"
      class="sel__trigger"
      :class="{ 'sel__trigger--chosen': isChosen }"
      :aria-expanded="open"
      :aria-controls="panelId"
      :aria-label="label || undefined"
      aria-haspopup="listbox"
      @click="open ? closePanel() : openPanel()"
      @keydown="onTriggerKeydown"
    >
      <span class="sel__value" :lang="triggerLang">{{ triggerLabel }}</span>
      <sup v-if="triggerCount !== undefined" class="sel__count">{{ triggerCount }}</sup>
      <span class="sel__chevron" aria-hidden="true" />
    </button>

    <div v-if="open" :id="panelId" class="sel__panel" @keydown="onPanelKeydown">
      <div v-if="showSearch" class="sel__search">
        <input
          ref="field"
          v-model="query"
          type="search"
          class="sel__field"
          :placeholder="searchPlaceholder"
          :aria-label="searchPlaceholder || label || undefined"
          autocomplete="off"
        >
      </div>
      <div v-if="visible.length" class="sel__list" role="listbox" :aria-label="label || undefined">
        <button
          v-for="(option, index) in visible"
          :key="option.value"
          :ref="el => setOptionRef(el, index)"
          type="button"
          role="option"
          class="sel__option"
          :class="{ 'is-active': option.value === modelValue, 'is-highlighted': index === highlighted }"
          :aria-selected="option.value === modelValue"
          :lang="option.lang"
          @click="choose(option)"
          @mousemove="highlighted = index"
        >
          <span class="sel__option-label">{{ option.label }}</span>
          <sup v-if="option.count !== undefined">{{ option.count }}</sup>
        </button>
      </div>
      <p v-else class="sel__empty">{{ emptyText }}</p>
    </div>
  </div>
</template>

<style scoped>
.sel { position: relative; display: inline-block; max-width: 100%; min-width: 0; }

/*
 * Trigger geometry is driven by these tokens so the inline and field looks
 * differ in one place — the field values are reused by the mobile override.
 */
.sel__trigger {
  --t-width: auto;
  --t-border: transparent;
  --t-min-h: auto;
  --t-pad-y: 0.35rem;
  --t-pad-l: 0;
  --t-pad-r: 1.2rem;
  --t-chevron-r: 0;
  --t-color: var(--muted);
  --t-underline: block;

  position: relative;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  width: var(--t-width);
  min-height: var(--t-min-h);
  padding: var(--t-pad-y) var(--t-pad-r) var(--t-pad-y) var(--t-pad-l);
  background: none;
  border: 1px solid var(--t-border);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--t-color);
  text-align: left;
  transition: border-color 0.2s, color 0.2s;
}
.sel--field { display: block; width: 100%; }
.sel--field .sel__trigger { width: 100%; }
.sel--field .sel__trigger {
  --t-border: var(--subtle);
  --t-min-h: 2.75rem;
  --t-pad-y: 0.7rem;
  --t-pad-l: 0.9rem;
  --t-pad-r: 2.2rem;
  --t-chevron-r: 0.95rem;
  --t-color: var(--dark);
  --t-underline: none;
}
.sel__trigger:hover { color: var(--dark); }
.sel--field .sel__trigger:hover { border-color: var(--accent); color: var(--accent); }
.sel__trigger:focus-visible { outline: none; color: var(--accent); }
.sel--field .sel__trigger:focus-visible { border-color: var(--accent); }
.sel__value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sel__count { font-size: 0.78em; color: var(--subtle); }
.sel__trigger--chosen,
.sel--open .sel__trigger { color: var(--accent); }
.sel--field .sel__trigger--chosen,
.sel--field.sel--open .sel__trigger { border-color: var(--accent); }
.sel__trigger--chosen .sel__count { color: var(--accent); }
/* Inline variant marks the selection with the same rule the chips use. */
.sel__trigger--chosen::after {
  content: '';
  display: var(--t-underline);
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 1px;
  background: var(--accent);
}

.sel__chevron {
  position: absolute;
  right: var(--t-chevron-r);
  top: 50%;
  width: 0.42rem;
  height: 0.42rem;
  border-right: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  transform: translateY(-68%) rotate(45deg);
  transition: transform 0.2s;
}
.sel--open .sel__chevron { transform: translateY(-24%) rotate(-135deg); }

.sel__panel {
  position: absolute;
  top: calc(100% + 0.85rem);
  z-index: 20;
  width: max-content;
  min-width: min(32rem, 82vw);
  max-width: min(44rem, 88vw);
  border-top: 2px solid var(--accent);
  background: color-mix(in srgb, var(--body-bg) 96%, white);
  box-shadow: 0 1.4rem 3.5rem rgba(26, 25, 24, 0.12);
}
.sel--end .sel__panel { right: 0; }
.sel--start .sel__panel { left: 0; }

.sel__search { border-bottom: 1px solid var(--subtle); padding: 0.75rem 1rem; }
.sel__field {
  width: 100%;
  background: none;
  border: none;
  padding: 0.2rem 0;
  font-family: var(--font-sans);
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  color: var(--dark);
}
.sel__field:focus { outline: none; }
.sel__field::placeholder {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-size: 0.56rem;
  color: var(--muted);
}
.sel__field::-webkit-search-cancel-button { -webkit-appearance: none; appearance: none; }

/*
 * Options sit in a grid. Dividers are drawn as the *leading* edge of each cell
 * (top for rows after the first, left for columns after the first) so a partly
 * filled last row never leaves a dangling rule.
 */
.sel__list { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
.sel__option:nth-child(n+4) { border-top: 1px solid var(--subtle); }
.sel__option:not(:nth-child(3n+1)) { border-left: 1px solid var(--subtle); }

.sel__option {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.85rem;
  width: 100%;
  min-height: 2.6rem;
  padding: 0.85rem 1rem;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  text-align: left;
  transition: color 0.15s, background 0.15s;
}
.sel__option-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sel__option sup { font-size: 0.78em; color: var(--subtle); flex-shrink: 0; }
.sel__option:focus-visible { outline: none; }
.sel__option.is-highlighted { color: var(--dark); background: color-mix(in srgb, var(--dark) 4%, transparent); }
.sel__option.is-active { color: var(--accent); background: color-mix(in srgb, var(--accent) 7%, transparent); }
.sel__option.is-active sup { color: var(--accent); }

.sel__empty {
  padding: 1.5rem 1rem;
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.85rem;
  color: var(--muted);
  text-align: center;
}

/* Thai names shouldn't be uppercased or widely tracked, whatever the locale. */
.sel__value:lang(th),
.sel__option:lang(th) {
  letter-spacing: 0.035em;
  text-transform: none;
}

@media (max-width: 720px) {
  /* Bordered, full-width trigger — a text label is too small to tap. Width is
     left to the parent so the control can share a row with sibling buttons. */
  .sel { display: block; }
  .sel .sel__trigger {
    --t-border: var(--subtle);
    --t-min-h: 2.75rem;
    --t-pad-y: 0.7rem;
    --t-pad-l: 0.9rem;
    --t-pad-r: 2.2rem;
    --t-chevron-r: 0.95rem;
    --t-color: var(--dark);
    --t-underline: none;

    display: flex;
    width: 100%;
  }
  .sel .sel__trigger--chosen,
  .sel--open .sel__trigger { border-color: var(--accent); }

  /* Full width, two columns — keeps long lists on screen without scrolling. */
  .sel__panel {
    top: calc(100% + 0.55rem);
    left: 0;
    right: 0;
    width: auto;
    min-width: 0;
    max-width: none;
  }
  .sel__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sel__option { gap: 0.45rem; padding: 0.8rem 0.75rem; }
  .sel__option:nth-child(n+3) { border-top: 1px solid var(--subtle); }
  .sel__option:nth-child(-n+2) { border-top: none; }
  .sel__option:not(:nth-child(2n+1)) { border-left: 1px solid var(--subtle); }
  .sel__option:nth-child(2n+1) { border-left: none; }
  .sel__field {
    /* 16px keeps iOS Safari from zooming the page on focus. */
    font-size: 16px;
    min-height: 1.75rem;
  }
  .sel__empty { grid-column: 1 / -1; }
}

@media (prefers-reduced-motion: reduce) {
  .sel__trigger,
  .sel__chevron,
  .sel__option { transition-duration: 0.01ms !important; }
}
</style>
