<script setup lang="ts">
// Tailwind Plus badge (rounded-md, ring-inset).
type Tone = 'gray' | 'green' | 'pink' | 'amber'
const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'gray' })

const tones: Record<Tone, string> = {
  gray: 'bg-zinc-100 text-zinc-600 ring-zinc-500/10',
  green: 'bg-green-50 text-green-700 ring-green-600/20',
  pink: 'bg-accent-soft text-pink-700 ring-pink-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20'
}
</script>

<template>
  <span
    class="inline-flex items-center gap-x-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset"
    :class="tones[props.tone]"
  >
    <slot />
  </span>
</template>
