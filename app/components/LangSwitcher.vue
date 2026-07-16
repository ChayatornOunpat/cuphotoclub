<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()

const options = computed(() => locales.value as { code: 'en' | 'th' }[])
</script>

<template>
  <span class="langswitch">
    <template v-for="(loc, i) in options" :key="loc.code">
      <span v-if="i > 0" class="langswitch__sep" aria-hidden="true">/</span>
      <NuxtLink
        :to="switchLocalePath(loc.code)"
        class="langswitch__opt"
        :class="{ 'is-active': loc.code === locale }"
      >{{ loc.code.toUpperCase() }}</NuxtLink>
    </template>
  </span>
</template>

<style scoped>
/* Inline EN / TH — styled to match the nav links exactly so it sits level. */
.langswitch { display: inline-flex; align-items: center; gap: 0.45rem; }

.langswitch__opt {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  text-decoration: none;
  color: rgba(245, 244, 240, 0.55);
  transition: color 0.2s;
}
.langswitch__opt:hover { color: var(--accent); }
.langswitch__opt.is-active { color: #F5F4F0; }

nav.light .langswitch__opt { color: var(--muted); }
nav.light .langswitch__opt:hover { color: var(--accent); }
nav.light .langswitch__opt.is-active { color: var(--dark); }

.langswitch__sep {
  font-size: 0.5rem;
  color: rgba(245, 244, 240, 0.3);
}
nav.light .langswitch__sep { color: var(--subtle); }
</style>
