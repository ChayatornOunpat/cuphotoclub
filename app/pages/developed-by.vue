<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()

const developerUrl = 'https://github.com/ILFforever'
const siteRepoUrl = 'https://github.com/ChayatornOunpat/cuphotoclub'
const developerEmail = 'hammymukura@gmail.com'
const developerPhone = '097-921-7776'
const isContactVisible = ref(false)
const tiltX = ref(0)
const tiltY = ref(0)
const glareX = ref(50)
const glareY = ref(50)
const isTilting = ref(false)
const isTiltResetting = ref(false)
let tiltResetTimer: ReturnType<typeof setTimeout> | undefined

const cardTiltStyle = computed(() => {
  const lift = Math.min(Math.hypot(tiltX.value, tiltY.value) / 7, 1)

  return {
    '--tilt-x': `${tiltX.value}deg`,
    '--tilt-y': `${tiltY.value}deg`,
    '--glare-x': `${glareX.value}%`,
    '--glare-y': `${glareY.value}%`,
    '--glare-opacity': isTilting.value ? '1' : '0',
    '--shadow-x': `${(10 - tiltY.value * 1.7).toFixed(2)}px`,
    '--shadow-y': `${(10 + tiltX.value * 1.7).toFixed(2)}px`,
    '--shadow-blur': `${(1.5 + lift * 13).toFixed(1)}px`,
    '--shadow-opacity': `${(0.92 - lift * 0.58).toFixed(2)}`
  }
})

function handleCardPointerMove(event: PointerEvent) {
  if (event.pointerType === 'touch') {
    return
  }

  if (tiltResetTimer) {
    clearTimeout(tiltResetTimer)
  }

  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1)
  const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1)

  tiltX.value = (0.5 - y) * 9
  tiltY.value = (x - 0.5) * 11
  glareX.value = x * 100
  glareY.value = y * 100
  isTilting.value = true
  isTiltResetting.value = false
}

function resetCardTilt() {
  if (tiltResetTimer) {
    clearTimeout(tiltResetTimer)
  }

  tiltX.value = 0
  tiltY.value = 0
  glareX.value = 50
  glareY.value = 50
  isTiltResetting.value = true
  isTilting.value = false

  tiltResetTimer = setTimeout(() => {
    isTiltResetting.value = false
  }, 280)
}

onBeforeUnmount(() => {
  if (tiltResetTimer) {
    clearTimeout(tiltResetTimer)
  }
})

useSeoMeta({
  title: () => t('developedBy.metaTitle'),
  description: () => t('developedBy.metaDescription')
})
</script>

<template>
  <div class="dev-page">
    <section class="dev-card-wrap" aria-labelledby="developed-by-title">
      <div
        class="dev-card-shell"
        :class="{
          'dev-card-shell--tilting': isTilting,
          'dev-card-shell--resetting': isTiltResetting
        }"
        :style="cardTiltStyle"
        @pointermove="handleCardPointerMove"
        @pointerleave="resetCardTilt"
      >
        <div class="dev-card-tilt">
          <article class="dev-card" :class="{ 'dev-card--flipped': isContactVisible }">
            <div class="dev-card__face dev-card__face--front" :aria-hidden="isContactVisible">
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
                    <a
                      :href="developerUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      :tabindex="isContactVisible ? -1 : undefined"
                    >ILFforever</a>
                  </h1>
                  <p class="dev-card__role">{{ t('developedBy.role') }}</p>
                </div>
              </div>

              <div class="dev-card__bottom">
                <p>{{ t('developedBy.madeWithLove') }}</p>
                <a
                  :href="siteRepoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :tabindex="isContactVisible ? -1 : undefined"
                >
                  {{ t('developedBy.githubLabel') }}
                </a>
              </div>
            </div>

            <div class="dev-card__face dev-card__face--back" :aria-hidden="!isContactVisible">
              <div class="dev-card__topline">
                <span>{{ t('developedBy.contactTitle') }}</span>
                <span>CU Photo Club</span>
              </div>

              <div class="dev-contact">
                <div class="dev-contact__intro">
                  <p class="dev-contact__eyebrow">{{ t('developedBy.contactEyebrow') }}</p>
                  <h2>{{ t('developedBy.contactHeading') }}</h2>
                </div>
                <div class="dev-contact__list">
                  <a :href="`mailto:${developerEmail}`" :tabindex="isContactVisible ? undefined : -1">
                    <span>Email</span>
                    {{ developerEmail }}
                  </a>
                  <a :href="`tel:${developerPhone.replaceAll('-', '')}`" :tabindex="isContactVisible ? undefined : -1">
                    <span>Phone</span>
                    {{ developerPhone }}
                  </a>
                </div>
              </div>

              <div class="dev-card__bottom">
                <p>{{ t('developedBy.contactNote') }}</p>
                <a
                  :href="siteRepoUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  :tabindex="isContactVisible ? undefined : -1"
                >
                  {{ t('developedBy.githubLabel') }}
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>

      <button
        class="dev-card-toggle"
        type="button"
        :aria-pressed="isContactVisible"
        @click="isContactVisible = !isContactVisible"
      >
        {{ isContactVisible ? t('developedBy.frontButton') : t('developedBy.contactButton') }}
      </button>
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

.dev-card-shell {
  --tilt-hit-padding: clamp(0.75rem, 3vw, 2.25rem);

  position: relative;
  width: min(100%, calc(64rem + var(--tilt-hit-padding) + var(--tilt-hit-padding)));
  min-height: calc(34rem + var(--tilt-hit-padding) + var(--tilt-hit-padding));
  margin: 0 auto;
  perspective: 1600px;
}

.dev-card-tilt {
  position: absolute;
  inset: var(--tilt-hit-padding, 0);
  transform:
    rotateX(var(--tilt-x, 0deg))
    rotateY(var(--tilt-y, 0deg));
  transform-style: preserve-3d;
  transition: transform 420ms cubic-bezier(0.19, 1, 0.22, 1);
  will-change: transform;
  isolation: isolate;
}

.dev-card-shell::before {
  position: absolute;
  inset: var(--tilt-hit-padding, 0);
  z-index: 2;
  pointer-events: none;
  content: '';
  background:
    radial-gradient(
      circle at var(--glare-x, 50%) var(--glare-y, 50%),
      color-mix(in srgb, white 34%, transparent) 0,
      transparent 46%
    );
  opacity: var(--glare-opacity, 0);
  transition: opacity 220ms ease;
}

.dev-card-shell--tilting .dev-card-tilt {
  transition-duration: 90ms;
}

.dev-card-shell--resetting .dev-card-tilt {
  transition-duration: 260ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.dev-card-shell::after {
  position: absolute;
  inset: var(--tilt-hit-padding, 0);
  z-index: -1;
  content: '';
  background: var(--dark);
  opacity: var(--shadow-opacity, 0.92);
  filter: blur(var(--shadow-blur, 1.5px));
  transform: translate(var(--shadow-x, 10px), var(--shadow-y, 10px));
  transition:
    transform 420ms cubic-bezier(0.19, 1, 0.22, 1),
    opacity 420ms ease,
    filter 420ms ease;
  pointer-events: none;
}

.dev-card-shell--tilting::after {
  transition-duration: 90ms;
}

.dev-card-shell--resetting::after {
  transition-duration: 260ms;
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

.dev-card {
  position: relative;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transition: transform 720ms cubic-bezier(0.19, 1, 0.22, 1);
}

.dev-card--flipped {
  transform: rotateY(180deg);
}

.dev-card__face {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: clamp(1.35rem, 3vw, 2.4rem);
  background:
    linear-gradient(90deg, transparent 0, transparent calc(100% - 9.5rem), color-mix(in srgb, var(--accent) 8%, transparent) calc(100% - 9.5rem)),
    var(--paper);
  --face-emboss:
    inset 0 3px 0 color-mix(in srgb, white 78%, transparent),
    inset 0 -6px 12px color-mix(in srgb, var(--dark) 16%, transparent),
    inset 0 40px 60px -50px color-mix(in srgb, white 60%, transparent);
  border: 1px solid var(--dark);
  box-shadow: var(--face-emboss);
  backface-visibility: hidden;
  overflow: hidden;
}

.dev-card__face--back {
  transform: rotateY(180deg);
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--accent) 9%, transparent) 0 7.5rem, transparent 7.5rem),
    repeating-linear-gradient(0deg, transparent 0 2.65rem, color-mix(in srgb, var(--dark) 6%, transparent) 2.65rem calc(2.65rem + 1px)),
    var(--paper);
}

.dev-card__face::before {
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  content: '';
  background: var(--accent);
}

.dev-card__face::after {
  position: absolute;
  inset: 1.2rem;
  pointer-events: none;
  content: '';
  border-color: color-mix(in srgb, var(--dark) 22%, transparent)
    color-mix(in srgb, var(--dark) 10%, transparent)
    color-mix(in srgb, var(--dark) 10%, transparent)
    color-mix(in srgb, var(--dark) 22%, transparent);
  border-style: solid;
  border-width: 1px;
  box-shadow: 1px 1px 0 color-mix(in srgb, white 78%, transparent);
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

.dev-contact {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: minmax(0, 0.92fr) minmax(19rem, 0.78fr);
  gap: clamp(2rem, 5vw, 5.2rem);
  align-self: center;
  align-items: end;
  max-width: none;
}

.dev-contact__eyebrow {
  margin: 0 0 0.75rem;
  color: var(--accent);
  font-size: 0.56rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.dev-contact h2 {
  max-width: 27rem;
  margin: 0;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(3rem, 5.7vw, 5.35rem);
  font-weight: 200;
  letter-spacing: 0;
  line-height: 0.94;
}

.dev-contact__list {
  display: grid;
  align-self: end;
  gap: 0;
  padding-bottom: 0.45rem;
}

.dev-contact__list a {
  display: grid;
  grid-template-columns: 4.6rem minmax(0, 1fr);
  gap: 1rem;
  align-items: baseline;
  width: 100%;
  padding: 1rem 0;
  color: var(--dark);
  border-top: 1px solid var(--subtle);
  font-size: clamp(1rem, 1.6vw, 1.24rem);
  text-decoration: none;
}

.dev-contact__list a:last-child {
  border-bottom: 1px solid var(--subtle);
}

.dev-contact__list a:hover,
.dev-contact__list a:focus-visible {
  color: var(--accent);
}

.dev-contact__list span {
  color: var(--muted);
  font-size: 0.54rem;
  letter-spacing: 0.2em;
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

.dev-card-toggle {
  display: block;
  margin: 2rem auto 0;
  padding: 0.8rem 1.25rem;
  color: var(--dark);
  background: transparent;
  border: 1px solid var(--dark);
  border-radius: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  transition:
    color 180ms ease,
    border-color 180ms ease,
    transform 180ms ease;
}

.dev-card-toggle:hover,
.dev-card-toggle:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .dev-card-shell {
    min-height: calc(48rem + var(--tilt-hit-padding) + var(--tilt-hit-padding));
  }

  .dev-card__main {
    grid-template-columns: 1fr;
    padding: 4rem 0 3rem;
  }

  .dev-card__portrait {
    width: min(13rem, 64vw);
  }

  .dev-contact h2 {
    font-size: clamp(3rem, 12vw, 5.2rem);
  }

  .dev-contact {
    grid-template-columns: 1fr;
    gap: 2.25rem;
    align-items: start;
  }
}

@media (max-width: 720px) {
  .dev-card-wrap {
    padding: 7.5rem 1.5rem 5rem;
  }

  .dev-card-shell {
    min-height: calc(45rem + var(--tilt-hit-padding) + var(--tilt-hit-padding));
  }

  .dev-card__face {
    padding: 1.2rem;
    box-shadow: var(--face-emboss);
  }

  .dev-card__face::after {
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

  .dev-contact__list a {
    grid-template-columns: 1fr;
    gap: 0.25rem;
    overflow-wrap: anywhere;
  }
}

@media (prefers-reduced-motion: reduce) {
  .dev-card-tilt {
    transform: none;
    transition: none;
  }

  .dev-card-shell::before {
    display: none;
  }

  .dev-card {
    transition: none;
  }

  .dev-card-toggle {
    transition: none;
  }
}
</style>
