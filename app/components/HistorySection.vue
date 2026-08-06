<script setup lang="ts">
defineProps<{
  history: {
    eyebrow: string
    image: string
    imageAlt: string
    quote: string
    quoteLead: string
    quoteAccent: string
    body: string[]
    sinceNum: string
    sinceText: string[]
    timeline: string[]
  }
}>()
</script>

<template>
  <section id="history" class="history">
    <div class="history__photo">
      <AppImg
        :src="history.image"
        :alt="history.imageAlt"
        width="1800"
        height="1200"
        sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw"
        optimize
      />
    </div>

    <div class="history__layout">
      <div class="history__axis" aria-hidden="true">
        <span v-for="tick in history.timeline" :key="tick" class="history__tick">{{ tick }}</span>
      </div>

      <div class="history__content">
        <div class="eyebrow history__eyebrow">
          <span class="num">03</span> {{ history.eyebrow }}
        </div>

        <blockquote class="history__quote">
          {{ history.quoteLead }}<em>{{ history.quoteAccent }}</em>
        </blockquote>

        <div class="history__bottom">
          <div class="history__body">
            <p v-for="(paragraph, i) in history.body" :key="i">{{ paragraph }}</p>
          </div>

          <div class="history__founded">
            <strong>{{ history.sinceNum }}</strong>
            <span>
              <template v-for="(line, i) in history.sinceText" :key="i">
                {{ line }}<br v-if="i < history.sinceText.length - 1">
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.history {
  position: relative;
  min-height: min(900px, calc(100svh - 5rem));
  overflow: hidden;
  background: var(--hero-bg);
  color: #F5F4F0;
}

.history__photo {
  position: absolute;
  inset: 0;
  background: var(--hero-bg);
}

.history__photo::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(12, 12, 10, 0.9) 0%, rgba(12, 12, 10, 0.64) 46%, rgba(12, 12, 10, 0.1) 100%);
}

.history__photo :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(0.72) sepia(0.14) contrast(1.08) brightness(0.72);
}

.history__layout {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: 130px minmax(0, 1fr);
  min-height: inherit;
  max-width: 1500px;
  margin: 0 auto;
  padding: 0 clamp(1rem, 4vw, 4rem);
}

.history__axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(4rem, 8vw, 7rem) 1.5rem clamp(3rem, 5vw, 5rem) 0;
  border-right: 1px solid rgba(245, 244, 240, 0.2);
}

.history__tick {
  position: relative;
  color: rgba(245, 244, 240, 0.38);
  font-size: 0.5rem;
  letter-spacing: 0.15em;
}

.history__tick::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -1.55rem;
  width: 0.55rem;
  height: 1px;
  background: rgba(245, 244, 240, 0.35);
}

.history__tick:first-child { color: var(--accent); }
.history__tick:first-child::after {
  right: -1.78rem;
  width: 7px;
  height: 7px;
  margin-top: -3px;
  border-radius: 50%;
  background: var(--accent);
}

.history__content {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  max-width: 980px;
  padding: clamp(4rem, 8vw, 7rem) 0 clamp(3rem, 5vw, 5rem) clamp(2rem, 7vw, 8rem);
}

.history__eyebrow {
  max-width: 360px;
  color: rgba(245, 244, 240, 0.52);
}

.history__quote {
  max-width: 920px;
  margin: 4rem 0;
  color: #F5F4F0;
  font-family: var(--font-serif);
  font-size: clamp(3.6rem, 7.3vw, 8.6rem);
  font-style: italic;
  font-weight: 200;
  letter-spacing: -0.055em;
  line-height: 0.87;
  text-wrap: balance;
}

.history__quote em {
  color: var(--accent);
  font-weight: 200;
}

.history__bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px;
  gap: 3rem;
  align-items: end;
}

.history__body {
  max-width: 640px;
  color: rgba(245, 244, 240, 0.6);
  font-size: 0.75rem;
  font-weight: 300;
  line-height: 1.85;
}

.history__body p + p { margin-top: 0.8rem; }

.history__founded {
  padding-left: 1.25rem;
  border-left: 2px solid var(--accent);
}

.history__founded strong {
  display: block;
  color: #F5F4F0;
  font-family: var(--font-serif);
  font-size: 3.8rem;
  font-weight: 200;
  line-height: 0.9;
}

.history__founded span {
  display: block;
  margin-top: 0.55rem;
  color: rgba(245, 244, 240, 0.45);
  font-size: 0.47rem;
  letter-spacing: 0.17em;
  line-height: 1.5;
  text-transform: uppercase;
}

@media (max-width: 980px) {
  .history { min-height: 820px; }
  .history__quote { font-size: clamp(3.4rem, 10vw, 7rem); }
}

@media (max-width: 680px) {
  .history { min-height: 880px; }
  .history__photo::after {
    background: linear-gradient(90deg, rgba(12, 12, 10, 0.9) 0%, rgba(12, 12, 10, 0.72) 72%, rgba(12, 12, 10, 0.35) 100%);
  }
  .history__layout {
    grid-template-columns: 54px minmax(0, 1fr);
    padding-inline: 1rem;
  }
  .history__axis { padding-right: 0.8rem; }
  .history__tick {
    font-size: 0.42rem;
    writing-mode: vertical-rl;
  }
  .history__tick::after { right: -0.85rem; }
  .history__tick:first-child::after { right: -1.06rem; }
  .history__content { min-width: 0; padding-left: 1.25rem; }
  .history__quote {
    max-width: 100%;
    margin: 3rem 0;
    font-size: clamp(3rem, 14vw, 4.5rem);
    overflow-wrap: break-word;
  }
  .history__bottom { grid-template-columns: 1fr; gap: 2rem; }
  .history__founded { margin-top: 0.5rem; }
}
</style>
