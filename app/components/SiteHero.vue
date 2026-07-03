<script setup lang="ts">
defineProps<{
  hero: {
    kicker: string
    kickerAccent: string
    title: { text: string, em?: boolean }[]
    image: string
    lead: string
    meta: string[]
  }
}>()

const offset = ref(0)

function onScroll() {
  offset.value = window.scrollY * 0.2
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <header id="hero" class="hero" data-chrome-header>
    <div class="hero__bg" :style="{ transform: `translateY(${offset}px)` }">
      <AppImg v-if="hero.image" :src="hero.image" alt="" width="1920" height="1080" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" eager />
    </div>
    <div class="hero__body">
      <p class="hero__kicker">{{ hero.kicker }}<span>{{ hero.kickerAccent }}</span></p>
      <h1 class="hero__title">
        <template v-for="(line, i) in hero.title" :key="i">
          <em v-if="line.em">{{ line.text }}</em><span v-else>{{ line.text }}</span><br v-if="i < hero.title.length - 1">
        </template>
      </h1>
    </div>
    <div class="hero__cut">
      <p class="hero__lead">{{ hero.lead }}</p>
      <div class="hero__meta">
        <template v-for="(m, i) in hero.meta" :key="i">
          {{ m }}<br v-if="i < hero.meta.length - 1">
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.hero {
  height: 100svh;
  background: var(--hero-bg);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}
.hero__bg {
  position: absolute;
  inset: 0;
  will-change: transform;
}
.hero__bg :deep(img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.45;
  display: block;
}
.hero__body {
  position: relative;
  z-index: 2;
  padding: 0 3rem 0;
  max-width: 1100px;
}
.hero__kicker {
  font-size: 0.56rem;
  letter-spacing: 0.3em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.5);
  margin-bottom: 1.5rem;
}
.hero__kicker span { color: var(--accent); }
.hero__title {
  font-family: var(--font-serif);
  font-size: clamp(4rem, 9.5vw, 11rem);
  font-weight: 200;
  line-height: 0.88;
  letter-spacing: -0.03em;
  color: #F5F4F0;
}
.hero__title em { font-style: italic; font-weight: 200; }

.hero__cut {
  position: relative;
  z-index: 2;
  margin-top: 4rem;
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: end;
  gap: 3rem;
  padding: 0 3rem 3rem;
}
.hero__lead {
  font-size: 0.8rem;
  color: rgba(245, 244, 240, 0.45);
  line-height: 1.85;
  max-width: 380px;
  font-weight: 300;
}
.hero__meta {
  text-align: right;
  font-size: 0.55rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: rgba(245, 244, 240, 0.35);
  line-height: 1.8;
}
</style>
