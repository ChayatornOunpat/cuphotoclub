<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()

const developerUrl = 'https://github.com/ILFforever'

useSeoMeta({
  title: () => t('developedBy.metaTitle'),
  description: () => t('developedBy.metaDescription')
})
</script>

<template>
  <div class="dev-page">
    <section class="dev-card-wrap" aria-labelledby="developed-by-title">
      <article class="dev-card">
        <div class="dev-card__topline">
          <span>{{ t('developedBy.kicker') }}</span>
          <span>2026</span>
        </div>

        <div class="dev-card__main">
          <div class="dev-card__portrait" aria-hidden="true">
            <img src="/developed-by-ilfforever.jpg" alt="">
          </div>

          <div class="dev-card__identity">
            <p class="dev-card__label">{{ t('developedBy.title') }}</p>
            <h1 id="developed-by-title">
              <a :href="developerUrl" target="_blank" rel="noopener noreferrer">ILFforever</a>
            </h1>
            <p class="dev-card__role">{{ t('developedBy.role') }}</p>
          </div>
        </div>

        <div class="dev-card__bottom">
          <p>{{ t('developedBy.madeWithLove') }}</p>
          <a :href="developerUrl" target="_blank" rel="noopener noreferrer">
            {{ t('developedBy.githubLabel') }}
          </a>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.dev-page {
  min-height: 76vh;
  background: var(--body-bg);
  display: grid;
  align-items: center;
}

.dev-card-wrap {
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;
  padding: 10rem 3rem 7rem;
}

.dev-card {
  position: relative;
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: min(100%, 64rem);
  min-height: 34rem;
  margin: 0 auto;
  padding: clamp(1.35rem, 3vw, 2.4rem);
  aspect-ratio: 1.72 / 1;
  background:
    linear-gradient(90deg, transparent 0, transparent calc(100% - 9.5rem), color-mix(in srgb, var(--accent) 8%, transparent) calc(100% - 9.5rem)),
    var(--paper);
  border: 1px solid var(--dark);
  box-shadow: 10px 10px 0 var(--dark);
  overflow: hidden;
}

.dev-card::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  content: '';
  background: var(--accent);
}

.dev-card::after {
  position: absolute;
  inset: 1.2rem;
  pointer-events: none;
  content: '';
  border: 1px solid color-mix(in srgb, var(--dark) 12%, transparent);
}

.dev-card__topline,
.dev-card__bottom {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  gap: 1.5rem;
  color: var(--muted);
  font-size: 0.54rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.dev-card__topline span:first-child {
  color: var(--accent);
}

.dev-card__main {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(9rem, 15rem) minmax(0, 1fr);
  gap: clamp(1.8rem, 5vw, 5rem);
  align-items: center;
}

.dev-card__portrait {
  aspect-ratio: 4 / 5;
  align-self: center;
  background: var(--body-bg);
  border: 1px solid var(--dark);
  box-shadow: 5px 5px 0 color-mix(in srgb, var(--dark) 18%, transparent);
  overflow: hidden;
}

.dev-card__portrait img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  object-position: center 28%;
}

.dev-card__label {
  margin-bottom: 0.6rem;
  color: var(--accent);
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.dev-card h1 {
  margin: 0 0 1rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(4rem, 8vw, 7.6rem);
  font-weight: 200;
  letter-spacing: 0;
  line-height: 0.92;
}

.dev-card h1 a {
  color: inherit;
  font-style: italic;
  text-decoration: none;
}

.dev-card h1 a:hover,
.dev-card h1 a:focus-visible {
  color: var(--accent);
}

.dev-card__role {
  color: var(--dark);
  font-size: 0.62rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.dev-card__bottom {
  align-items: flex-end;
  border-top: 1px solid var(--subtle);
  padding-top: 1rem;
}

.dev-card__bottom p {
  max-width: 18rem;
  margin: 0;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(1rem, 1.8vw, 1.45rem);
  font-style: italic;
  letter-spacing: 0;
  line-height: 1.25;
  text-transform: none;
}

.dev-card__bottom a {
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
}

.dev-card__bottom a:hover,
.dev-card__bottom a:focus-visible {
  color: var(--dark);
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25em;
}

@media (max-width: 900px) {
.dev-card {
    aspect-ratio: auto;
    min-height: 0;
  }

  .dev-card__main {
    grid-template-columns: 1fr;
    padding: 4rem 0 3rem;
  }

  .dev-card__portrait {
    width: min(13rem, 64vw);
  }
}

@media (max-width: 720px) {
  .dev-card-wrap {
    padding: 7.5rem 1.5rem 5rem;
  }

  .dev-card {
    padding: 1.2rem;
    box-shadow: 6px 6px 0 var(--dark);
  }

  .dev-card::after {
    inset: 0.75rem;
  }

  .dev-card__topline,
  .dev-card__bottom {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.8rem;
  }

  .dev-card h1 {
    font-size: clamp(3rem, 15vw, 4.6rem);
  }
}
</style>
