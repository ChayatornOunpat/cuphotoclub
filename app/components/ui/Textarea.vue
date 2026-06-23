<script setup lang="ts">
const model = defineModel<string>()
defineProps<{ id?: string, placeholder?: string, rows?: number }>()
</script>

<template>
  <textarea
    :id="id"
    v-model="model"
    :placeholder="placeholder"
    :rows="rows || 3"
    class="block w-full rounded-md bg-white px-3 py-1.5 text-sm text-ink outline-1 -outline-offset-1 outline-line placeholder:text-ink-soft/50 focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
  />
</template>
