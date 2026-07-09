<script setup lang="ts">
import { defaultSite } from '~/utils/defaultSite'

// Emit per-locale SEO head tags for all public pages: <html lang/dir>,
// <link rel="canonical">, hreflang alternates (en/th/x-default), and og:locale.
// Uses i18n.baseUrl (nuxt.config) so URLs are absolute on the real domain.
const localeHead = useLocaleHead()
useHead(localeHead)

// Shared chrome for inner pages (albums, and later blog): reading-progress bar,
// the dark→light nav handoff, header parallax, and the footer — all driven by
// the page's own markup via data-attributes:
//   [data-chrome-header] → nav goes light once this element scrolls past
//                          (no such element on a page → nav is always light)
//   [data-parallax]      → translated on scroll for a parallax header
const site = ref(defaultSite)
const localizedSite = useLocalizedSite(site)

const navLight = ref(false)
const progress = ref(0)

function onScroll() {
  const total = document.body.scrollHeight - window.innerHeight
  progress.value = total > 0 ? (window.scrollY / total) * 100 : 0

  const header = document.querySelector('[data-chrome-header]')
  navLight.value = header ? header.getBoundingClientRect().bottom < 64 : true

  const els = document.querySelectorAll<HTMLElement>('[data-parallax]')
  for (const el of els) el.style.transform = `translateY(${window.scrollY * 0.2}px)`
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <div>
    <div id="progress-track">
      <div id="progress" :style="{ width: progress + '%' }" />
    </div>
    <SiteNav v-if="localizedSite" :links="localizedSite.nav.links" :light="navLight" />
    <main>
      <slot />
    </main>
    <SiteFooter v-if="localizedSite" :footer="localizedSite.footer" />
  </div>
</template>
