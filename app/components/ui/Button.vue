<script setup lang="ts">
// Mirrors Tailwind Plus button styles (their indigo → our --color-accent token).
type Variant = 'primary' | 'secondary' | 'soft' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const props = withDefaults(defineProps<{
  variant?: Variant
  size?: Size
  type?: 'button' | 'submit' | 'reset'
  to?: string
  disabled?: boolean
  loading?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'md',
  type: 'button'
})

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-xs hover:bg-accent/90 focus-visible:outline-accent',
  secondary: 'bg-white text-ink shadow-xs ring-1 ring-inset ring-line hover:bg-paper-soft focus-visible:outline-accent',
  soft: 'bg-accent-soft text-pink-700 hover:bg-accent-soft/70 focus-visible:outline-accent',
  danger: 'bg-red-600 text-white shadow-xs hover:bg-red-500 focus-visible:outline-red-600'
}
const sizes: Record<Size, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-2 text-sm',
  lg: 'px-3.5 py-2.5 text-sm'
}

const classes = computed(() => [
  'inline-flex items-center justify-center gap-x-1.5 rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
  variants[props.variant],
  sizes[props.size],
  props.block ? 'w-full' : ''
])
</script>

<template>
  <NuxtLink v-if="to" :to="to" :class="classes">
    <UiSpinner v-if="loading" />
    <slot />
  </NuxtLink>
  <button v-else :type="type" :disabled="disabled || loading" :class="classes">
    <UiSpinner v-if="loading" />
    <slot />
  </button>
</template>
