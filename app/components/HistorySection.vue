<script setup lang="ts">
defineProps<{
  history: {
    eyebrow: string
    image: string
    quote: string
    body: string[]
    sinceNum: string
    sinceText: string[]
  }
}>()
</script>

<template>
  <section id="history" class="history">
    <div class="wrap history__grid">
      <div class="history__photo">
        <AppImg :src="history.image" alt="Archive" width="900" height="675" sizes="sm:100vw lg:50vw" optimize />
      </div>
      <div>
        <div class="eyebrow history__eyebrow">
          <span class="num">03</span> {{ history.eyebrow }}
        </div>
        <blockquote class="history__quote">"{{ history.quote }}"</blockquote>
        <div class="history__body">
          <p v-for="(p, i) in history.body" :key="i">{{ p }}</p>
        </div>
        <div class="history__since">
          <div class="history__since-num">{{ history.sinceNum }}</div>
          <div class="history__since-text">
            <template v-for="(t, i) in history.sinceText" :key="i">
              {{ t }}<br v-if="i < history.sinceText.length - 1">
            </template>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.history {
  background: #2C2A26;
  color: #F0EDE6;
  padding: 6rem 3rem;
  position: relative;
  overflow: hidden;
}
.history::before {
  content: '';
  position: absolute;
  top: 0; left: 0;
  width: 4px;
  height: 100%;
  background: var(--accent);
}
.history__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6rem;
  align-items: center;
}
.history__photo :deep(img) {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  display: block;
  filter: sepia(0.5) contrast(1.1) brightness(0.82);
}
.history__eyebrow { max-width: 360px; color: rgba(240, 237, 230, 0.4); }
.history__quote {
  font-family: var(--font-serif);
  font-size: clamp(1.8rem, 3vw, 3.2rem);
  font-style: italic;
  font-weight: 200;
  line-height: 1.35;
  color: #F0EDE6;
  margin-bottom: 2.25rem;
  padding-left: 2rem;
  border-left: 2px solid var(--accent);
}
.history__body {
  font-size: 0.82rem;
  color: rgba(240, 237, 230, 0.55);
  line-height: 1.95;
  font-weight: 300;
}
.history__body p + p { margin-top: 1rem; }
.history__since {
  margin-top: 2rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}
.history__since-num {
  font-family: var(--font-serif);
  font-size: 3.5rem;
  font-weight: 200;
  color: var(--accent);
  line-height: 1;
}
.history__since-text {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 237, 230, 0.45);
  line-height: 1.55;
}

@media (max-width: 820px) {
  .history__grid { grid-template-columns: 1fr; gap: 3rem; }
}
</style>
