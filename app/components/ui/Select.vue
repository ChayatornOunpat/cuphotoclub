<script setup lang="ts">
const model = defineModel<string>()
defineProps<{ id?: string }>()
</script>

<template>
  <!-- Tailwind Plus select pattern (grid overlay for the chevron). -->
  <div class="grid grid-cols-1">
    <select
      :id="id"
      v-model="model"
      class="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-1.5 pl-3 pr-8 text-sm text-ink outline-1 -outline-offset-1 outline-line focus:outline-2 focus:-outline-offset-2 focus:outline-accent"
    >
      <slot />
    </select>
    <Icon
      name="heroicons:chevron-down"
      class="pointer-events-none col-start-1 row-start-1 mr-2 size-4 self-center justify-self-end text-ink-soft"
    />
  </div>
</template>
