<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number | string
  icon: string
  to?: string
}>()

// Resolve the real NuxtLink component (a string "NuxtLink" in :is doesn't resolve → dead <nuxtlink> element).
const NuxtLink = resolveComponent('NuxtLink')
const tag = computed(() => (props.to ? NuxtLink : 'div'))
</script>

<template>
  <component
    :is="tag"
    :to="to"
    class="flex items-center gap-4 rounded-lg border border-line bg-white p-5 transition-shadow"
    :class="to ? 'hover:shadow-sm' : ''"
  >
    <span class="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-pink-700">
      <Icon :name="icon" class="size-6" />
    </span>
    <div>
      <p class="text-2xl font-semibold text-ink">{{ value }}</p>
      <p class="text-sm text-ink-soft">{{ label }}</p>
    </div>
  </component>
</template>
