<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  error?: string
  inputId?: string
}>()
</script>

<template>
  <div>
    <label v-if="label" :for="inputId" class="block text-sm font-medium text-ink">{{ label }}</label>
    <div :class="label ? 'mt-1.5' : ''">
      <slot />
    </div>
    <p v-if="error" class="mt-1 text-xs text-red-600">{{ error }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-ink-soft">{{ hint }}</p>
  </div>
</template>
