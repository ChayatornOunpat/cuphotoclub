<script setup lang="ts">
const model = defineModel<string>()
defineProps<{
  id?: string
  type?: string
  placeholder?: string
  autocomplete?: string
  required?: boolean
  invalid?: boolean
}>()
</script>

<template>
  <!-- Tailwind Plus form input pattern (outline-based). -->
  <input
    :id="id"
    v-model="model"
    :type="type || 'text'"
    :placeholder="placeholder"
    :autocomplete="autocomplete"
    :required="required"
    class="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-ink outline-1 -outline-offset-1 outline-line placeholder:text-ink-soft/50 focus:outline-2 focus:-outline-offset-2 focus:outline-accent disabled:cursor-not-allowed disabled:bg-paper-soft disabled:text-ink-soft"
    :class="invalid ? 'outline-red-400' : ''"
  >
</template>
