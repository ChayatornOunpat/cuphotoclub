<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  id?: string
  required?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{ focus: [] }>()

const nativeEl = ref<HTMLInputElement | null>(null)
const textEl = ref<HTMLInputElement | null>(null)

function isISODate(value?: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDisplayDate(value?: string | null) {
  if (!isISODate(value)) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function toISODate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

// Masks input to digits only and auto-inserts slashes as DD/MM/YYYY, so
// typing can never produce anything but a well-formed date string.
function maskDigits(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

const text = ref(toDisplayDate(model.value))

watch(model, (value) => {
  if (import.meta.client && document.activeElement === textEl.value) return
  text.value = toDisplayDate(value)
})

function onTextInput() {
  text.value = maskDigits(text.value)
  const parsed = toISODate(text.value)
  if (parsed) model.value = parsed
}

function commitText() {
  const parsed = toISODate(text.value)
  if (parsed === null) {
    text.value = toDisplayDate(model.value)
    return
  }
  model.value = parsed
  text.value = toDisplayDate(parsed)
}

function openPicker() {
  const el = nativeEl.value
  if (!el || el.disabled) return
  if (typeof el.showPicker === 'function') el.showPicker()
  else el.focus()
}

function onNativeChange() {
  model.value = nativeEl.value?.value || ''
  text.value = toDisplayDate(model.value)
}

defineExpose({
  focus: () => textEl.value?.focus(),
  select: () => textEl.value?.select()
})
</script>

<template>
  <div class="ui-date-input relative flex items-center">
    <input
      :id="id"
      ref="textEl"
      v-model="text"
      type="text"
      inputmode="numeric"
      placeholder="DD/MM/YYYY"
      :required="required"
      :disabled="disabled"
      class="ui-date-input__text block w-full bg-white px-3 py-1.5 pr-9 text-sm text-ink outline-1 -outline-offset-1 outline-line placeholder:text-ink-soft/50 focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-ink-soft"
      @input="onTextInput"
      @focus="emit('focus')"
      @blur="commitText"
      @keydown.enter.prevent="commitText"
    >
    <button
      type="button"
      tabindex="-1"
      :disabled="disabled"
      class="absolute right-1.5 flex size-6 items-center justify-center text-ink-soft hover:text-ink disabled:cursor-not-allowed disabled:text-ink-soft/40"
      @click="openPicker"
    >
      <Icon name="heroicons:calendar-days" class="size-4" />
    </button>
    <input
      ref="nativeEl"
      type="date"
      tabindex="-1"
      :value="model"
      :disabled="disabled"
      class="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      @change="onNativeChange"
    >
  </div>
</template>
