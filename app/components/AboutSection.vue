<script setup lang="ts">
defineProps<{
  about: {
    eyebrow: string
    heading: { text: string, em?: boolean }[]
    body: string
    cta: { label: string, to: string }
    image: string
    imageAlt: string
    photoCaption: string
    coordinates: string
    floor: string
    route: { label: string, lines: string[] }[]
  }
}>()
</script>

<template>
  <section id="about" class="about">
    <div class="wrap about__inner">
      <div class="about__visual">
        <span class="about__floor" aria-hidden="true">{{ about.floor }}</span>
        <div class="about__photo">
          <AppImg
            :src="about.image"
            :alt="about.imageAlt"
            width="900"
            height="1125"
            sizes="sm:100vw lg:45vw"
            optimize
          />
        </div>
        <div class="about__photo-meta">
          <span>{{ about.photoCaption }}</span>
          <span>{{ about.coordinates }}</span>
        </div>
      </div>

      <div class="about__content">
        <div class="eyebrow about__eyebrow"><span class="num">04</span> {{ about.eyebrow }}</div>
        <h2 class="about__heading">
          <template v-for="(line, i) in about.heading" :key="i">
            <em v-if="line.em">{{ line.text }}</em><template v-else>{{ line.text }}</template><br v-if="i < about.heading.length - 1">
          </template>
        </h2>
        <p class="about__body">{{ about.body }}</p>

        <div class="about__route">
          <div v-for="step in about.route" :key="step.label" class="about__step">
            <strong>{{ step.label }}</strong>
            <span v-for="line in step.lines" :key="line">{{ line }}</span>
          </div>
        </div>

        <a
          :href="about.cta.to"
          class="about__link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {{ about.cta.label }}
          <Icon name="heroicons:arrow-up-right" aria-hidden="true" />
        </a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about {
  background: var(--paper);
  border-top: 2px solid var(--accent);
  padding: clamp(3rem, 6vw, 6rem) clamp(1rem, 4vw, 4rem);
}

.about__inner {
  display: grid;
  grid-template-columns: minmax(360px, 0.9fr) minmax(0, 1.1fr);
  min-height: min(760px, calc(100svh - 7rem));
  padding: 0;
  background: var(--body-bg);
  box-shadow: 0 1.5rem 5rem rgba(26, 25, 24, 0.12);
}

.about__visual {
  position: relative;
  min-height: 600px;
  padding: 2rem;
  overflow: hidden;
  background: var(--dark);
  color: #F5F4F0;
}

.about__floor {
  position: absolute;
  z-index: 2;
  top: 1.5rem;
  right: 1.7rem;
  color: var(--accent);
  font-family: var(--font-serif);
  font-size: clamp(6rem, 11vw, 11rem);
  font-weight: 200;
  letter-spacing: -0.08em;
  line-height: 0.8;
}

.about__photo {
  height: 78%;
  margin-top: 3.5rem;
  overflow: hidden;
  background: #242320;
}

.about__photo :deep(img) {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: grayscale(1) contrast(1.08);
}

.about__photo-meta {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 1.1rem;
  color: rgba(245, 244, 240, 0.55);
  font-size: 0.47rem;
  letter-spacing: 0.14em;
  line-height: 1.5;
  text-transform: uppercase;
}

.about__content {
  display: flex;
  flex-direction: column;
  padding: clamp(2rem, 5vw, 5.5rem);
}

.about__eyebrow { max-width: 320px; }

.about__heading {
  margin: clamp(3.5rem, 7vw, 6.5rem) 0 2rem;
  font-family: var(--font-serif);
  font-size: clamp(3.2rem, 6vw, 6.8rem);
  font-weight: 200;
  letter-spacing: -0.045em;
  line-height: 0.9;
}

.about__heading em {
  color: var(--accent);
  font-style: italic;
  font-weight: 200;
}

.about__body {
  max-width: 34rem;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.9;
}

.about__route {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: auto;
  padding: 2.4rem 0 2rem;
}

.about__step {
  position: relative;
  padding-right: 1rem;
  border-top: 1px solid var(--subtle);
}

.about__step::before {
  content: '';
  position: absolute;
  top: -4px;
  left: 0;
  width: 7px;
  height: 7px;
  background: var(--body-bg);
  border: 1px solid var(--muted);
  border-radius: 50%;
}

.about__step:last-child::before {
  border-color: var(--accent);
  background: var(--accent);
}

.about__step strong,
.about__step span { display: block; }

.about__step strong {
  margin: 1.1rem 0 0.45rem;
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.about__step span {
  color: var(--muted);
  font-size: 0.62rem;
  line-height: 1.5;
}

.about__link {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.8rem;
  color: var(--dark);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.18em;
  text-decoration: none;
  text-transform: uppercase;
  transition: color 0.2s ease;
}

.about__link :deep(svg),
.about__link :deep(.iconify) {
  width: 0.85rem;
  height: 0.85rem;
  transition: transform 0.2s ease;
}

.about__link:hover { color: var(--accent); }
.about__link:hover :deep(svg),
.about__link:hover :deep(.iconify) { transform: translate(0.18rem, -0.18rem); }

@media (max-width: 820px) {
  .about__inner { grid-template-columns: 1fr; }
  .about__visual { min-height: 500px; }
  .about__content { min-height: 620px; }
}

@media (max-width: 520px) {
  .about__visual {
    min-height: 420px;
    padding: 1.25rem;
  }
  .about__content { min-height: 560px; }
  .about__photo-meta { font-size: 0.42rem; }
  .about__route { gap: 0.25rem; }
}

@media (prefers-reduced-motion: reduce) {
  .about__link,
  .about__link :deep(svg),
  .about__link :deep(.iconify) { transition: none; }
}
</style>
