<script setup lang="ts">
type Variant = 'primary' | 'secondary' | 'danger'
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
</script>

<template>
  <NuxtLink v-if="to" :to="to" class="ui-btn" :class="[`ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block']">
    <UiSpinner v-if="loading" />
    <slot />
  </NuxtLink>
  <button
    v-else
    :type="type"
    :disabled="disabled || loading"
    class="ui-btn"
    :class="[`ui-btn--${variant}`, `ui-btn--${size}`, block && 'ui-btn--block']"
  >
    <UiSpinner v-if="loading" />
    <slot />
  </button>
</template>

<style scoped>
.ui-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  font-family: var(--font-sans);
  font-size: 0.52rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  border: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}
.ui-btn:disabled { opacity: 0.5; cursor: default; }
.ui-btn--block { width: 100%; }

/* sizes */
.ui-btn--sm { padding: 0.4rem 0.7rem; }
.ui-btn--md { padding: 0.55rem 1.1rem; }
.ui-btn--lg { padding: 0.7rem 1.5rem; }

/* primary — dark fill, hover accent */
.ui-btn--primary { background: var(--dark); color: #F5F4F0; border: 1px solid var(--dark); }
.ui-btn--primary:not(:disabled):hover { background: var(--accent); border-color: var(--accent); }

/* secondary — outline, hover accent border + text */
.ui-btn--secondary { background: none; color: var(--dark); border: 1px solid var(--subtle); }
.ui-btn--secondary:not(:disabled):hover { border-color: var(--accent); color: var(--accent); }

/* danger */
.ui-btn--danger { background: #b0243c; color: #F5F4F0; border: 1px solid #b0243c; }
.ui-btn--danger:not(:disabled):hover { background: #8f1c30; border-color: #8f1c30; }
</style>
