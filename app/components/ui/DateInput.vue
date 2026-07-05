<script setup lang="ts">
const model = defineModel<string>({ default: '' })
defineProps<{
  id?: string
  required?: boolean
  disabled?: boolean
}>()
</script>

<template>
  <input
    :id="id"
    v-model="model"
    type="date"
    lang="en-GB"
    :required="required"
    :disabled="disabled"
    class="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-ink outline-1 -outline-offset-1 outline-line focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-ink-soft"
  >
</template>
