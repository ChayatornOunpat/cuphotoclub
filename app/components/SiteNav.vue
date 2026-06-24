<script setup lang="ts">
defineProps<{
  links: { label: string, to: string, join?: boolean }[]
  light: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()
</script>

<template>
  <nav :class="{ light }">
    <NuxtLink :to="localePath('/')" class="logo"><span class="cu">CU</span>PHOTOCLUB</NuxtLink>
    <ul class="nav-links">
      <li v-for="link in links" :key="link.label">
        <NuxtLink :to="localePath(link.to)" :class="{ join: link.join }">{{ t(`nav.${link.label.toLowerCase()}`) }}</NuxtLink>
      </li>
      <li><LangSwitcher /></li>
    </ul>
  </nav>
</template>

<style scoped>
nav {
  position: fixed;
  inset-block-start: 2px; /* below progress bar */
  inset-inline: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 3rem;
  transition: background 0.4s ease;
}
nav.light {
  background: rgba(245, 244, 240, 0.93);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--subtle);
}

.logo {
  font-family: var(--font-sans);
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-decoration: none;
  line-height: 1;
  color: #F5F4F0;
  transition: color 0.4s ease;
}
nav.light .logo { color: var(--dark); }
.logo .cu { color: var(--accent); }

.nav-links { display: flex; align-items: center; gap: 2.5rem; list-style: none; }
.nav-links a {
  font-size: 0.58rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.55);
  text-decoration: none;
  transition: color 0.2s;
}
nav.light .nav-links a { color: var(--muted); }
.nav-links a:hover,
nav.light .nav-links a:hover { color: var(--accent); }
.nav-links a.join { color: var(--accent) !important; }
</style>
