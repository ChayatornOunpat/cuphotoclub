<script setup lang="ts">
// ── Bespoke scroll indicator: corner chapter + progress ──────────────────────
// A quiet bottom-right readout: the current section name (a "chapter") over a
// thin accent progress line. Matches .impeccable.md — pink as a precise accent
// (a word + a rule), sharp lines, restraint.
//
// Page-agnostic by design: it scans the page for elements marked
// `data-chapter="Name"` and shows whichever you're currently in. Pages that
// declare no chapters degrade gracefully to just the progress line (no label).
// Re-scans on route change so it adapts as you navigate. Purely an indicator —
// it never intercepts scrolling or captures pointer events.

const route = useRoute()

const enabled = ref(false) // page is scrollable
const active = ref(false) // recently scrolled (opacity boost)
const atHero = ref(false) // still within the hero / large header → stay hidden
const percent = ref(0) // 0..100 fill
const chapter = ref('') // current chapter name ('' → line only)

interface Chapter { el: HTMLElement, name: string }
let chapters: Chapter[] = []
let dimTimer: ReturnType<typeof setTimeout> | null = null

function scan() {
  chapters = Array.from(
    document.querySelectorAll<HTMLElement>('[data-chapter]')
  ).map(el => ({ el, name: el.getAttribute('data-chapter') || '' }))
  update()
}

function update() {
  const range = document.documentElement.scrollHeight - window.innerHeight
  enabled.value = range > 2
  percent.value = range > 0 ? Math.min(100, Math.max(0, (window.scrollY / range) * 100)) : 0

  // Hide while the hero (or any large [data-chrome-header]) is still on screen —
  // same threshold the nav uses to flip dark→light, so the two stay in sync.
  const header = document.querySelector<HTMLElement>('[data-chrome-header]')
  atHero.value = header ? header.getBoundingClientRect().bottom > 64 : false

  if (chapters.length) {
    const marker = window.innerHeight * 0.4
    let current = chapters[0]?.name ?? ''
    for (const c of chapters) {
      if (c.el.getBoundingClientRect().top <= marker) current = c.name
    }
    chapter.value = current
  }
  else {
    chapter.value = ''
  }
}

function onScroll() {
  update()
  active.value = true
  if (dimTimer) clearTimeout(dimTimer)
  dimTimer = setTimeout(() => { active.value = false }, 1400)
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  scan()
  window.addEventListener('scroll', onScroll, { passive: true })
  window.addEventListener('resize', update)
  // Content height/sections settle after async data + images — keep synced.
  resizeObserver = new ResizeObserver(() => update())
  resizeObserver.observe(document.body)
})

// New page → different (or no) chapters; rescan after the DOM settles.
watch(() => route.fullPath, () => {
  chapter.value = ''
  nextTick(() => {
    scan()
    setTimeout(scan, 150)
  })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
  window.removeEventListener('resize', update)
  resizeObserver?.disconnect()
  if (dimTimer) clearTimeout(dimTimer)
})
</script>

<template>
  <ClientOnly>
    <div v-show="enabled" class="scrollmark" :class="{ 'scrollmark--active': active && !atHero, 'scrollmark--hidden': atHero }" aria-hidden="true">
      <Transition name="scrollmark-name" mode="out-in">
        <span v-if="chapter" :key="chapter" class="scrollmark__name">{{ chapter }}</span>
      </Transition>
      <div class="scrollmark__track">
        <i :style="{ width: percent + '%' }" />
      </div>
    </div>
  </ClientOnly>
</template>

<style scoped>
.scrollmark {
  position: fixed;
  right: 1.5rem;
  bottom: 1.35rem;
  z-index: 300;
  text-align: right;
  pointer-events: none; /* pure indicator, never steals clicks */
  opacity: 0; /* hidden at rest — only surfaces while actively scrolling */
  transition: opacity 0.45s ease;
}
.scrollmark--active {
  opacity: 1;
}
.scrollmark--hidden {
  opacity: 0;
}

.scrollmark__name {
  display: block;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.5rem;
}

.scrollmark__track {
  height: 2px;            /* sharp line, no radius */
  width: 46px;
  margin-left: auto;
  background: rgba(124, 122, 114, 0.30);
  overflow: hidden;
}
.scrollmark__track i {
  display: block;
  height: 100%;
  background: var(--accent);
  transition: width 0.12s linear;
}

/* Chapter name cross-fade */
.scrollmark-name-enter-active,
.scrollmark-name-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.scrollmark-name-enter-from {
  opacity: 0;
  transform: translateY(3px);
}
.scrollmark-name-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

/* Thai labels: the global rule relaxes tracking/casing on uppercase labels. */
:global(html:lang(th)) .scrollmark__name {
  letter-spacing: 0.035em;
  text-transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .scrollmark__track i,
  .scrollmark-name-enter-active,
  .scrollmark-name-leave-active { transition: none; }
}
</style>
