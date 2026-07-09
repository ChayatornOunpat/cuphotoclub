<script setup lang="ts">
defineProps<{
  links: { label: string, to: string, join?: boolean }[]
  light: boolean
}>()

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()

const open = ref(false)
function close() { open.value = false }

watch(() => route.fullPath, close)

// Prevent body scroll while menu is open
watch(open, v => {
  if (import.meta.client) document.body.style.overflow = v ? 'hidden' : ''
})
</script>

<template>
  <nav :class="{ light, 'menu-open': open }">
    <NuxtLink :to="localePath('/')" class="logo" @click="close">
      <span class="cu">CU</span>PHOTOCLUB
    </NuxtLink>

    <!-- Desktop links -->
    <ul class="nav-links">
      <li v-for="link in links" :key="link.label">
        <NuxtLink :to="localePath(link.to)" :class="{ join: link.join }">
          {{ t(`nav.${link.label.toLowerCase()}`) }}
        </NuxtLink>
      </li>
      <li><LangSwitcher /></li>
    </ul>

    <!-- Hamburger button -->
    <button class="burger" type="button" :aria-expanded="open" aria-label="Toggle menu" @click="open = !open">
      <span class="burger__line" />
      <span class="burger__line" />
      <span class="burger__line" />
    </button>
  </nav>

  <!-- Mobile overlay -->
  <Teleport to="body">
    <Transition name="menu">
      <div v-if="open" class="mobile-menu" role="dialog" aria-modal="true">
        <div class="mobile-menu__inner">
          <ul>
            <li v-for="link in links" :key="link.label">
              <NuxtLink :to="localePath(link.to)" :class="{ join: link.join }" @click="close">
                {{ t(`nav.${link.label.toLowerCase()}`) }}
              </NuxtLink>
            </li>
          </ul>
          <div class="mobile-menu__lang">
            <LangSwitcher />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
nav {
  position: fixed;
  inset-block-start: 2px;
  inset-inline: 0;
  z-index: 200;
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
  z-index: 1;
}
nav.light .logo,
nav.menu-open .logo { color: var(--dark); }
.logo .cu { color: var(--accent); }

/* Desktop nav links */
.nav-links {
  display: flex;
  align-items: center;
  gap: 2.5rem;
  list-style: none;
}
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

/* Hamburger */
.burger {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  z-index: 1;
}
.burger__line {
  display: block;
  width: 100%;
  height: 1.5px;
  background: #F5F4F0;
  transition: background 0.4s ease, transform 0.25s ease, opacity 0.25s ease;
}
nav.light .burger__line,
nav.menu-open .burger__line { background: var(--dark); }

/* X state */
nav.menu-open .burger .burger__line:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
nav.menu-open .burger .burger__line:nth-child(2) { opacity: 0; }
nav.menu-open .burger .burger__line:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

@media (max-width: 1120px) {
  nav { padding: 1.25rem 1.5rem; }
  .nav-links { display: none; }
  .burger { display: flex; }
}
</style>

<!-- Mobile menu: unscoped so Teleport renders outside nav -->
<style>
.mobile-menu {
  position: fixed;
  inset: 0;
  z-index: 190;
  background: #F5F4F0;
  display: flex;
  flex-direction: column;
}
.mobile-menu__inner {
  display: flex;
  flex-direction: column;
  justify-content: center;
  flex: 1;
  padding: 6rem 2rem 3rem;
}
.mobile-menu__inner ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.mobile-menu__inner a {
  display: block;
  font-family: var(--font-serif);
  font-size: clamp(2rem, 8vw, 3.5rem);
  font-weight: 200;
  line-height: 1.15;
  color: var(--dark);
  text-decoration: none;
  letter-spacing: -0.01em;
  padding: 0.35rem 0;
  transition: color 0.15s;
  border-bottom: 1px solid var(--subtle);
}
.mobile-menu__inner a:last-of-type { border-bottom: none; }
.mobile-menu__inner a:hover,
.mobile-menu__inner a.join { color: var(--accent); }
.mobile-menu__lang {
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--subtle);
}

.menu-enter-active,
.menu-leave-active { transition: opacity 0.25s ease, transform 0.25s ease; }
.menu-enter-from,
.menu-leave-to { opacity: 0; transform: translateY(-12px); }
</style>
