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

// A single ruled dateline, not a section: only the soonest event is shown
// (items arrive sorted ascending), and the rest live on /activities.
const nextItem = computed(() => props.items[0] ?? null)
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
  <section v-if="nextItem" id="activities-preview" class="activities-line" :aria-label="t('home.activitiesEyebrow')">
    <div class="activities-line__inner">
      <p class="activities-line__label">{{ t('home.activitiesNextLabel') }}</p>
      <NuxtLink :to="nextItem.path" class="activities-line__event">
        <time class="activities-line__date" :datetime="nextItem.date || undefined">{{ formatActivityDate(nextItem) }}</time>
        <span class="activities-line__title">{{ nextItem.title }}</span>
        <span v-if="nextItem.location" class="activities-line__location">{{ nextItem.location }}</span>
      </NuxtLink>
      <NuxtLink :to="localePath('/activities')" class="activities-line__all">
        {{ t('home.viewAllActivities') }} →
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.activities-line {
  margin: clamp(2rem, 5vw, 4rem) 0;
  padding: 0 clamp(1rem, 4vw, 4rem);
  color: var(--dark);
}

.activities-line__inner {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem 1.6rem;
  max-width: 1450px;
  margin: 0 auto;
  padding: 1.35rem 0.25rem;
  border-top: 1px solid rgba(26, 25, 24, 0.16);
  border-bottom: 1px solid rgba(26, 25, 24, 0.16);
}

.activities-line__label {
  color: rgba(26, 25, 24, 0.45);
  font-size: 0.52rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.activities-line__event {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.75rem 1.3rem;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.activities-line__date {
  color: var(--accent);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.activities-line__title {
  font-family: var(--font-serif);
  font-size: clamp(1.15rem, 1.8vw, 1.5rem);
  font-style: italic;
  font-weight: 300;
  letter-spacing: -0.02em;
  line-height: 1.1;
  transition: color 180ms ease;
}

.activities-line__event:hover .activities-line__title,
.activities-line__event:focus-visible .activities-line__title {
  color: var(--accent);
}

.activities-line__event:focus-visible,
.activities-line__all:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 3px;
}

.activities-line__location {
  color: rgba(26, 25, 24, 0.4);
  font-size: 0.43rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.activities-line__all {
  margin-left: auto;
  color: var(--accent);
  font-size: 0.48rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
  white-space: nowrap;
}

.activities-line__all:hover { color: var(--dark); }

@media (max-width: 680px) {
  .activities-line__inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.55rem;
  }
  .activities-line__all { margin-left: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .activities-line__title { transition: none; }
}
</style>
