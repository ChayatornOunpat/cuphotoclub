<script setup lang="ts">
interface ActivityItem {
  title: string
  date: string
  endDate: string
  location: string
  path: string
}

const props = defineProps<{
  items: ActivityItem[]
}>()

const { t, locale } = useI18n()
const localePath = useLocalePath()

const visibleItems = computed(() => props.items.slice(0, 3))
const intlLocale = computed(() => locale.value === 'th' ? 'th-TH' : 'en-GB')

function asDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatActivityDate(item: ActivityItem) {
  const start = asDate(item.date)
  if (!start) return t('activities.comingSoon')

  const day = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', timeZone: 'UTC' })
  const dayMonth = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const end = asDate(item.endDate)

  if (!end || item.endDate === item.date) return dayMonth.format(start)
  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${day.format(start)}—${dayMonth.format(end)}`
  }
  return `${dayMonth.format(start)}—${dayMonth.format(end)}`
}
</script>

<template>
  <section v-if="visibleItems.length" id="activities-preview" class="activities-strip" :aria-label="t('home.activitiesEyebrow')">
    <div class="activities-strip__inner">
      <header class="activities-strip__head">
        <p class="activities-strip__eyebrow">{{ t('home.activitiesEyebrow') }}</p>
        <h2>{{ t('home.activitiesHeadingLead') }} <em>{{ t('home.activitiesHeadingAccent') }}</em></h2>
      </header>

      <div class="activities-strip__events">
        <NuxtLink
          v-for="(item, index) in visibleItems"
          :key="item.path"
          :to="item.path"
          class="activities-strip__event"
        >
          <span class="activities-strip__wash" aria-hidden="true" />
          <span class="activities-strip__index">
            {{ t('home.activitiesFrame', { current: String(index + 1).padStart(2, '0'), total: String(visibleItems.length).padStart(2, '0') }) }}
          </span>
          <time class="activities-strip__date" :datetime="item.date || undefined">{{ formatActivityDate(item) }}</time>
          <h3>{{ item.title }}</h3>
          <p v-if="item.location" class="activities-strip__location">{{ item.location }}</p>
        </NuxtLink>
      </div>

      <NuxtLink :to="localePath('/activities')" class="activities-strip__all">
        <span>{{ t('home.viewAllActivities') }} →</span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.activities-strip {
  padding: 0 clamp(1rem, 4vw, 4rem);
  background: var(--hero-bg);
  color: var(--body-bg);
}

.activities-strip__inner {
  display: grid;
  grid-template-columns: 210px minmax(0, 1fr) 72px;
  max-width: 1450px;
  margin: 0 auto;
}

.activities-strip__head {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 2.2rem 2rem 2.2rem 0;
  border-right: 1px solid rgba(245, 244, 240, 0.16);
}

.activities-strip__eyebrow {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  color: rgba(245, 244, 240, 0.52);
  font-size: 0.52rem;
  font-weight: 400;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.activities-strip__eyebrow::after {
  content: '';
  width: 2.8rem;
  height: 1px;
  background: currentColor;
  opacity: 0.35;
}

.activities-strip__head h2 {
  margin-top: 2.2rem;
  font-family: var(--font-serif);
  font-size: clamp(2rem, 3vw, 2.7rem);
  font-style: italic;
  font-weight: 200;
  letter-spacing: -0.035em;
  line-height: 0.95;
}

.activities-strip__head em {
  color: var(--accent);
  font-weight: 200;
}

.activities-strip__events {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.activities-strip__event {
  position: relative;
  min-width: 0;
  min-height: 260px;
  padding: 2rem;
  overflow: hidden;
  border-right: 1px solid rgba(245, 244, 240, 0.16);
  color: inherit;
  text-decoration: none;
}

.activities-strip__event::after {
  content: '';
  position: absolute;
  right: 1.2rem;
  bottom: 1rem;
  left: 1.2rem;
  height: 3px;
  background: repeating-linear-gradient(90deg, rgba(245, 244, 240, 0.28) 0 2px, transparent 2px 10px);
}

.activities-strip__event > *:not(.activities-strip__wash) {
  position: relative;
  z-index: 1;
}

.activities-strip__wash {
  position: absolute;
  inset: 0;
  background: var(--accent);
  opacity: 0;
  transform: translateY(100%);
  transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease;
}

.activities-strip__event:hover .activities-strip__wash,
.activities-strip__event:focus-visible .activities-strip__wash {
  opacity: 0.08;
  transform: translateY(0);
}

.activities-strip__event:focus-visible {
  z-index: 2;
  outline: 1px solid var(--accent);
  outline-offset: -1px;
}

.activities-strip__index {
  color: rgba(245, 244, 240, 0.32);
  font-size: 0.45rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.activities-strip__date {
  display: block;
  margin-top: 2.8rem;
  color: var(--accent);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.activities-strip__event h3 {
  max-width: 270px;
  margin-top: 0.8rem;
  font-family: var(--font-serif);
  font-size: clamp(1.25rem, 2.1vw, 2.05rem);
  font-weight: 300;
  letter-spacing: -0.025em;
  line-height: 1.05;
}

.activities-strip__location {
  margin-top: 1rem;
  color: rgba(245, 244, 240, 0.43);
  font-size: 0.43rem;
  letter-spacing: 0.14em;
  line-height: 1.5;
  text-transform: uppercase;
}

.activities-strip__all {
  display: grid;
  place-items: center;
  color: var(--accent);
  text-decoration: none;
}

.activities-strip__all span {
  writing-mode: vertical-rl;
  transform: rotate(180deg);
  font-size: 0.48rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.activities-strip__all:hover span,
.activities-strip__all:focus-visible span { color: var(--body-bg); }
.activities-strip__all:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }

@media (max-width: 980px) {
  .activities-strip__inner { grid-template-columns: 180px minmax(0, 1fr) 60px; }
  .activities-strip__events { grid-template-columns: 1fr; }
  .activities-strip__event { min-height: 190px; }
  .activities-strip__date { margin-top: 1.4rem; }
}

@media (max-width: 680px) {
  .activities-strip__inner { grid-template-columns: minmax(0, 1fr) 48px; }
  .activities-strip__head {
    grid-column: 1 / -1;
    padding-right: 0;
    border-right: 0;
    border-bottom: 1px solid rgba(245, 244, 240, 0.16);
  }
  .activities-strip__head h2 { max-width: 10rem; }
  .activities-strip__events { grid-column: 1; }
  .activities-strip__event { min-height: 180px; padding-inline: 0.5rem; }
  .activities-strip__event::after { right: 0.5rem; left: 0.5rem; }
  .activities-strip__all { grid-row: 2; grid-column: 2; }
}

@media (prefers-reduced-motion: reduce) {
  .activities-strip__wash { transition: none; }
}
</style>
