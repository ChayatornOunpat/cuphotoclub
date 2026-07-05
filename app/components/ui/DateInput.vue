<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  id?: string
  required?: boolean
  disabled?: boolean
  placeholder?: string
}>()

const el = ref<HTMLInputElement | null>(null)
const text = ref(toDisplayDate(model.value))

function isISODate(value?: string | null) {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDisplayDate(value?: string | null) {
  if (!isISODate(value)) return ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year.slice(-2)}`
}

function toISODate(value: string) {
  const raw = value.trim()
  if (!raw) return ''

  const separated = raw.match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{2}|\d{4})$/)
  const compact = raw.match(/^(\d{2})(\d{2})(\d{2}|\d{4})$/)
  const match = separated || compact
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3])
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return `${year}-${pad2(month)}-${pad2(day)}`
}

watch(model, (value) => {
  if (import.meta.client && document.activeElement === el.value) return
  text.value = toDisplayDate(value)
})

function onInput() {
  const parsed = toISODate(text.value)
  if (parsed) model.value = parsed
}

function commit() {
  const parsed = toISODate(text.value)
  if (parsed === null) {
    text.value = toDisplayDate(model.value)
    return
  }
  model.value = parsed
  text.value = toDisplayDate(parsed)
}
</script>

<template>
  <input
    :id="id"
    ref="el"
    v-model="text"
    type="text"
    inputmode="numeric"
    :required="required"
    :disabled="disabled"
    :placeholder="placeholder || 'DD/MM/YY'"
    class="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-ink outline-1 -outline-offset-1 outline-line placeholder:text-ink-soft/50 focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-ink-soft"
    @input="onInput"
    @blur="commit"
    @keydown.enter.prevent="commit"
  >
</template>
