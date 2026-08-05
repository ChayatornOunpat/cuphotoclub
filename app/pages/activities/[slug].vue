<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface EventItem {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: string | null
  endDate: string | null
  location: string | null
  registerUrl: string | null
  publishedAt: string | null
  bodyHtml: string
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const slug = route.params.slug as string

const { data: ev, error } = await useFetch<EventItem>(`/api/events/${slug}`)
if (error.value || !ev.value) {
  throw createError({ statusCode: 404, statusMessage: t('activities.notFound'), fatal: true })
}

const origin = useRequestURL().origin
const imageSrc = computed(() => {
  const key = ev.value?.coverR2Key?.trim()
  if (!key) return ''
  if (/^(https?:)?\/\//i.test(key) || key.startsWith('/')) return key
  return `/images/${key}`
})
const coverUrl = computed(() => {
  if (!imageSrc.value) return undefined
  return /^https?:\/\//i.test(imageSrc.value) ? imageSrc.value : `${origin}${imageSrc.value}`
})
const intlLocale = computed(() => (locale.value === 'th' ? 'th-TH' : 'en-GB'))
// Keep image-only activity bodies visible; stripping tags made a body containing
// only Markdown images look empty even though it had meaningful content.
const hasBody = computed(() => Boolean(ev.value?.bodyHtml?.trim()))

// Event dates are stored as UTC midnight, so a fixed UTC timezone recovers the
// intended calendar day regardless of the viewer's timezone.
function formatEventDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(intlLocale.value, { ...options, timeZone: 'UTC' }).format(new Date(value))
}

const dateRange = computed(() => {
  if (!ev.value?.eventDate) return t('activities.comingSoon')
  const options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
  const start = formatEventDate(ev.value.eventDate, options)
  if (!ev.value.endDate || ev.value.endDate === ev.value.eventDate) return start
  return `${start} - ${formatEventDate(ev.value.endDate, options)}`
})
// Shorter form for the hero meta line.
const dateShort = computed(() => {
  if (!ev.value?.eventDate) return t('activities.comingSoon')
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  const start = formatEventDate(ev.value.eventDate, options)
  if (!ev.value.endDate || ev.value.endDate === ev.value.eventDate) return start
  return `${start} - ${formatEventDate(ev.value.endDate, options)}`
})
const dateDay = computed(() => ev.value?.eventDate ? formatEventDate(ev.value.eventDate, { day: '2-digit' }) : '')

useSeoMeta({
  title: () => ev.value!.title,
  description: () => ev.value!.summary || ev.value!.title,
  ogImage: () => coverUrl.value,
  ogType: 'article',
  twitterCard: () => (coverUrl.value ? 'summary_large_image' : 'summary')
})

useHead(() => ({
  script: [{
    type: 'application/ld+json',
    innerHTML: JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: ev.value!.title,
      description: ev.value!.summary || ev.value!.title,
      image: coverUrl.value ? [coverUrl.value] : undefined,
      startDate: ev.value!.eventDate || undefined,
      endDate: ev.value!.endDate || ev.value!.eventDate || undefined,
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      location: ev.value!.location ? { '@type': 'Place', name: ev.value!.location } : undefined,
      url: `${origin}/activities/${ev.value!.slug}`,
      organizer: { '@type': 'Organization', name: 'CU Photo Club', url: origin },
      offers: ev.value!.registerUrl
        ? { '@type': 'Offer', url: ev.value!.registerUrl, availability: 'https://schema.org/InStock' }
        : undefined
    })
  }]
}))
</script>

<template>
  <article v-if="ev" class="event-page">
    <!-- Cinematic hero -->
    <header class="hero" :class="{ 'hero--empty': !imageSrc }" data-chrome-header>
      <div v-if="imageSrc" class="hero__photo" data-parallax data-hero-dim>
        <img :src="imageSrc" :alt="ev.title" fetchpriority="high">
      </div>
      <span v-else class="hero__numeral" aria-hidden="true">{{ dateDay }}</span>
      <div class="hero__scrim" aria-hidden="true" />

      <div class="hero__inner">
        <NuxtLink :to="localePath('/activities')" class="hero__back">
          <Icon name="heroicons:arrow-left" aria-hidden="true" />
          {{ t('activities.backToList') }}
        </NuxtLink>

        <div class="hero__head">
          <p class="hero__kicker">{{ t('activities.kicker') }}</p>
          <h1 class="hero__title">{{ ev.title }}</h1>
          <div class="hero__meta">
            <span><Icon name="heroicons:calendar-days" aria-hidden="true" />{{ dateShort }}</span>
            <span v-if="ev.location"><Icon name="heroicons:map-pin" aria-hidden="true" />{{ ev.location }}</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Reading column + details rail -->
    <section class="event-body">
      <div class="event-body__inner">
        <main class="story">
          <p v-if="ev.summary" class="story__lead">{{ ev.summary }}</p>
          <div v-if="hasBody" class="story__body" v-html="ev.bodyHtml" />
        </main>

        <aside class="rail">
          <dl class="facts">
            <div class="facts__row">
              <dt>{{ t('activities.when') }}</dt>
              <dd>{{ dateRange }}</dd>
            </div>
            <div v-if="ev.location" class="facts__row">
              <dt>{{ t('activities.where') }}</dt>
              <dd>{{ ev.location }}</dd>
            </div>
          </dl>

          <div v-if="ev.registerUrl" class="rail__cta">
            <p class="rail__prompt">{{ t('activities.interested') }}</p>
            <a :href="ev.registerUrl" target="_blank" rel="noopener" class="register-link">
              <span>{{ t('activities.register') }}</span>
              <Icon name="heroicons:arrow-up-right" aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </section>

    <footer class="event-exit">
      <NuxtLink :to="localePath('/activities')" class="back-link">
        <Icon name="heroicons:arrow-left" aria-hidden="true" />
        {{ t('activities.backToList') }}
      </NuxtLink>
    </footer>
  </article>
</template>

<style scoped>
.event-page {
  min-height: 100vh;
  overflow: clip;
  background: var(--body-bg);
}

/* ── Cinematic hero ── */
.hero {
  position: relative;
  height: clamp(30rem, calc(100svh - 3.5rem), 46rem);
  overflow: hidden;
  background: var(--hero-bg);
  color: #F5F4F0;
}
.hero__photo { position: absolute; inset: -10% 0; will-change: transform; }
.hero__photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
/* Darkens as the hero scrolls upward — driven by --hero-dim from the layout. */
.hero__photo::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 10, calc(var(--hero-dim, 0) * 0.6));
  pointer-events: none;
}
.hero__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(12,12,10,0.88) 0%, rgba(12,12,10,0.15) 52%, rgba(12,12,10,0.4) 100%);
}
.hero--empty .hero__scrim {
  background: linear-gradient(to top, rgba(12,12,10,0.7) 0%, rgba(12,12,10,0.2) 60%);
}
.hero__numeral {
  position: absolute;
  right: -0.02em;
  bottom: -0.24em;
  color: rgba(245,244,240,0.05);
  font: 200 30rem/1 var(--font-serif);
  pointer-events: none;
}

.hero__inner {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: min(100%, 1380px);
  height: 100%;
  margin: 0 auto;
  padding: 7.25rem 3rem 3rem;
}

.hero__back {
  display: inline-flex;
  align-items: center;
  align-self: flex-start;
  gap: 0.55rem;
  min-height: 2.75rem;
  color: rgba(245,244,240,0.78);
  font-size: 0.6rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 180ms ease;
}
.hero__back:hover,
.hero__back:focus-visible { color: #F5F4F0; }
.hero__back:focus-visible,
.register-link:focus-visible,
.back-link:focus-visible { outline: 2px solid var(--accent); outline-offset: 5px; }

.hero__kicker {
  color: var(--accent);
  font-size: 0.58rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}
.hero__title {
  max-width: 16ch;
  margin-top: 1.2rem;
  color: #F5F4F0;
  font: 200 clamp(2.6rem, 6.5vw, 5.75rem)/0.96 var(--font-serif);
  letter-spacing: -0.01em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}
.hero__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.6rem 2rem;
  margin-top: 1.6rem;
  color: rgba(245,244,240,0.85);
  font-size: 0.74rem;
  line-height: 1.5;
}
.hero__meta span { display: inline-flex; align-items: center; gap: 0.5rem; min-width: 0; }
.hero__back :deep(svg),
.hero__meta :deep(svg),
.register-link :deep(svg),
.back-link :deep(svg) { flex: 0 0 auto; width: 1rem; height: 1rem; }
.hero__meta :deep(svg) { color: var(--accent); }

/* ── Body ── */
.event-body__inner {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(16rem, 21rem);
  gap: 5rem;
  width: min(100%, 1180px);
  margin: 0 auto;
  padding: 5.5rem 3rem 8rem;
  align-items: start;
}
.story { min-width: 0; }
.story__lead {
  max-width: 24ch;
  color: var(--dark);
  font: 300 clamp(1.7rem, 3vw, 2.2rem)/1.32 var(--font-serif);
  letter-spacing: -0.005em;
  overflow-wrap: anywhere;
}
.story__body {
  max-width: 44rem;
  margin-top: 2.75rem;
  color: var(--dark);
  font-size: 1rem;
  line-height: 1.9;
  overflow-wrap: anywhere;
}
.story__body :deep(> :first-child) { margin-top: 0; }
.story__body :deep(p),
.story__body :deep(ul),
.story__body :deep(ol),
.story__body :deep(blockquote) { margin-top: 1.5rem; }
.story__body :deep(h2),
.story__body :deep(h3) {
  margin-top: 3rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-weight: 300;
  line-height: 1.2;
}
.story__body :deep(h2) { font-size: 2rem; }
.story__body :deep(h3) { font-size: 1.4rem; }
.story__body :deep(ul),
.story__body :deep(ol) { padding-left: 1.25rem; }
.story__body :deep(a) { color: var(--dark); text-decoration-color: var(--accent); text-underline-offset: 0.22em; }
.story__body :deep(a:hover) { color: var(--accent); }
.story__body :deep(blockquote) {
  padding: 0.25rem 0 0.25rem 1.5rem;
  border-left: 2px solid var(--accent);
  color: var(--muted);
  font: 300 1.35rem/1.55 var(--font-serif);
}
.story__body :deep(img) { display: block; width: 100%; height: auto; margin: 2.5rem 0; }
.story__body :deep(table) { display: block; max-width: 100%; margin-top: 2rem; overflow-x: auto; border-collapse: collapse; }
.story__body :deep(th),
.story__body :deep(td) { padding: 0.7rem; border: 1px solid var(--subtle); text-align: left; }

/* ── Details rail ── */
.rail {
  position: sticky;
  top: 6rem;
  min-width: 0;
  border-top: 2px solid var(--dark);
}
.facts__row {
  display: grid;
  grid-template-columns: 4rem minmax(0, 1fr);
  gap: 1rem;
  padding: 1.2rem 0;
  border-bottom: 1px solid var(--subtle);
}
.facts dt {
  color: var(--muted);
  font-size: 0.56rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.facts dd {
  min-width: 0;
  margin: 0;
  color: var(--dark);
  font-size: 0.78rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.rail__cta { padding-top: 1.75rem; }
.rail__prompt {
  margin-bottom: 1rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.6;
}
.register-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-height: 3.5rem;
  padding: 0.8rem 1.2rem;
  border: 1px solid var(--dark);
  background: var(--dark);
  color: #F5F4F0;
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background 180ms ease, border-color 180ms ease;
}
.register-link:hover { border-color: var(--accent); background: var(--accent); }

/* ── Exit ── */
.event-exit {
  display: flex;
  align-items: center;
  min-height: 8rem;
  padding: 2rem max(3rem, calc((100% - 1180px) / 2));
  border-top: 1px solid var(--subtle);
  background: var(--paper);
}
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  color: var(--dark);
  font-size: 0.62rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 180ms ease;
}
.back-link:hover { color: var(--accent); }

/* ── Responsive ── */
@media (max-width: 900px) {
  .event-body__inner { grid-template-columns: 1fr; gap: 3rem; }
  .rail { position: static; }
}
@media (max-width: 700px) {
  .hero { height: calc(100svh - 3rem); min-height: 28rem; max-height: 40rem; }
  .hero__photo { inset: -6% 0; }
  .hero__numeral { font-size: 16rem; }
  .hero__inner { padding: 6rem 1.25rem 2.25rem; }
  .hero__title { max-width: 100%; }
  .hero__meta { gap: 0.5rem; }
  .event-body__inner { padding: 3.5rem 1.25rem 5rem; }
  .story__lead { max-width: none; }
  .story__body { margin-top: 2.25rem; font-size: 0.94rem; }
  .facts__row { grid-template-columns: 3.75rem minmax(0, 1fr); }
  .register-link { min-height: 3.75rem; }
  .event-exit { min-height: 6rem; padding-inline: 1.25rem; }
}

@media (prefers-reduced-motion: reduce) {
  .hero__photo { transition: none; }
}

/* Thai serif needs a touch more leading and weight than the Latin display. */
:global(html:lang(th)) .hero__title { font-weight: 300; line-height: 1.06; }
:global(html:lang(th)) .story__lead,
:global(html:lang(th)) .story__body { line-height: 1.95; }
</style>
