<script setup lang="ts">
defineProps<{
  about: {
    eyebrow: string
    heading: { text: string, em?: boolean }[]
    body: string
    cta: { label: string, to: string }
    image: string
  }
}>()
</script>

<template>
  <section id="about" class="about">
    <div class="wrap about__inner">
      <div>
        <div class="eyebrow about__eyebrow"><span class="num">04</span> {{ about.eyebrow }}</div>
        <h2 class="about__heading">
          <template v-for="(line, i) in about.heading" :key="i">
            <em v-if="line.em">{{ line.text }}</em><template v-else>{{ line.text }}</template><br v-if="i < about.heading.length - 1">
          </template>
        </h2>
        <p class="about__body">{{ about.body }}</p>
        <a :href="about.cta.to" class="btn-hybrid">{{ about.cta.label }} →</a>
      </div>
      <div class="about__photo">
        <AppImg :src="about.image" alt="About" width="900" height="675" sizes="sm:100vw lg:50vw" eager />
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  background: var(--body-bg);
  border-top: 2px solid var(--accent);
  padding: 6rem 3rem;
}
.about__inner {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6rem;
  align-items: center;
}
.about__eyebrow { max-width: 320px; }
.about__heading {
  font-family: var(--font-serif);
  font-size: clamp(2.5rem, 4vw, 5rem);
  font-weight: 200;
  line-height: 1;
  letter-spacing: -0.03em;
  margin-bottom: 1.75rem;
}
.about__heading em { font-style: italic; color: var(--accent); }
.about__body {
  font-size: 0.875rem;
  color: var(--muted);
  line-height: 1.95;
  margin-bottom: 2.5rem;
}
.btn-hybrid {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.62rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #F5F4F0;
  background: var(--dark);
  text-decoration: none;
  padding: 1rem 2.25rem;
  transition: background 0.25s ease;
}
.btn-hybrid:hover { background: var(--accent); }
.about__photo { overflow: hidden; aspect-ratio: 4 / 3; }
.about__photo :deep(img) {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}

@media (max-width: 820px) {
  .about__inner { grid-template-columns: 1fr; gap: 3rem; }
}
</style>
