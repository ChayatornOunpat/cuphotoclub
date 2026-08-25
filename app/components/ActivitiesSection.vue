<script setup lang="ts">
interface ActivityItem {
  title: string
  summary: string
  image: string
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

// One featured event, presented like the other chapters' lead content. Items
// arrive sorted soonest-first and already filtered to upcoming by /api/home.
const nextEvent = computed(() => props.items[0] ?? null)

function asDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatActivityDate(item: ActivityItem) {
  const start = asDate(item.date)
  if (!start) return t('activities.comingSoon')

  const end = asDate(item.endDate)

  if (!end || item.endDate === item.date) return formatDayMonth(start, locale.value)
  if (start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()) {
    return `${formatDayNumber(start, locale.value)}—${formatDayMonth(end, locale.value)}`
  }
  return `${formatDayMonth(start, locale.value)}—${formatDayMonth(end, locale.value)}`
}
</script>

<template>
  <section v-if="nextEvent" id="activities-preview" class="section-pad activities">
    <div class="wrap">
      <div class="eyebrow"><span class="num">03</span> {{ t('home.activitiesEyebrow') }}</div>

      <NuxtLink
        :to="nextEvent.path"
        class="afeature"
        :class="{ 'afeature--text-only': !nextEvent.image }"
      >
        <!-- coverR2Key is nullable: with no photo the type simply takes the full
             width rather than reserving an empty frame. -->
        <div v-if="nextEvent.image" class="afeature__media">
          <AppImg
            :src="nextEvent.image"
            :alt="nextEvent.title"
            width="900"
            height="700"
            sizes="sm:100vw lg:48vw"
            optimize
          />
        </div>

        <div class="afeature__body">
          <p class="afeature__kicker">{{ t('home.activitiesNextLabel') }}</p>
          <time class="afeature__date" :datetime="nextEvent.date || undefined">
            {{ formatActivityDate(nextEvent) }}
          </time>
          <h3 class="afeature__title">{{ nextEvent.title }}</h3>
          <p v-if="nextEvent.summary" class="afeature__summary">{{ nextEvent.summary }}</p>
          <p v-if="nextEvent.location" class="afeature__location">{{ nextEvent.location }}</p>
          <span class="afeature__cta">{{ t('home.activitiesDetails') }} →</span>
        </div>
      </NuxtLink>

      <div class="activities__footer">
        <NuxtLink :to="localePath('/activities')" class="activities__view-all">
          {{ t('home.viewAllActivities') }} →
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* A numbered chapter like Featured Work and Latest: same .section-pad / .wrap
   grid and .eyebrow heading. Stays on --body-bg so it continues the light run —
   History already owns the page's dark moment. */
.activities {
  background: var(--body-bg);
}

.afeature {
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1fr);
  margin-top: 3rem;
  border-top: 1px solid var(--subtle);
  border-bottom: 1px solid var(--subtle);
  color: inherit;
  text-decoration: none;
}

.afeature--text-only { grid-template-columns: minmax(0, 1fr); }

/* The image is taken out of flow (the same device .scard-lead uses in Latest) so
   a tall poster cover can't drive the row height — the frame sets its own size
   and the image fills it. Without this, a portrait cover renders at its natural
   aspect ratio and dwarfs the type beside it. */
.afeature__media {
  position: relative;
  min-height: clamp(15rem, 24vw, 19rem);
  overflow: hidden;
}

.afeature__media :deep(img) {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.afeature:hover .afeature__media :deep(img) { transform: scale(1.03); }

.afeature__body {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 2.6rem 0 2.8rem 2.75rem;
}

.afeature--text-only .afeature__body { padding-left: 0; }

.afeature__kicker {
  color: var(--accent);
  font-size: 0.5rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.afeature__date {
  margin-top: 0.9rem;
  font-family: var(--font-serif);
  font-size: clamp(1.9rem, 3.4vw, 2.6rem);
  font-style: italic;
  font-weight: 300;
  letter-spacing: -0.03em;
  line-height: 1;
}

.afeature__title {
  margin-top: 0.5rem;
  font-family: var(--font-serif);
  font-size: clamp(1.4rem, 2.6vw, 2rem);
  font-weight: 300;
  letter-spacing: -0.026em;
  line-height: 1.06;
  transition: color 0.22s ease;
}

.afeature:hover .afeature__title,
.afeature:focus-visible .afeature__title { color: var(--accent); }

.afeature__summary {
  margin-top: 0.9rem;
  max-width: 44ch;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.8;
}

.afeature__location {
  margin-top: 1.1rem;
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.afeature__cta {
  margin-top: 1.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid var(--accent);
  color: var(--dark);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.afeature:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 3px;
}

.activities__footer {
  margin-top: 2.75rem;
  display: flex;
  justify-content: flex-end;
}

/* Mirrors .stories__view-all so the two feed chapters end the same way. */
.activities__view-all {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: min(100%, 11rem);
  padding: 0.35rem 0 0.62rem;
  color: var(--dark);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  line-height: 1.2;
  text-transform: uppercase;
  text-decoration: none;
  transition: color 0.22s ease;
}

.activities__view-all::before,
.activities__view-all::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 1px;
}

.activities__view-all::before {
  width: 100%;
  background: color-mix(in srgb, var(--dark) 22%, transparent);
}

.activities__view-all::after {
  width: 42%;
  background: var(--accent);
  transform-origin: left;
  transition: width 0.24s ease;
}

.activities__view-all:hover,
.activities__view-all:focus-visible { color: var(--accent); }

.activities__view-all:hover::after,
.activities__view-all:focus-visible::after { width: 100%; }

.activities__view-all:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 0.45rem;
}

@media (max-width: 860px) {
  .afeature { grid-template-columns: minmax(0, 1fr); margin-top: 2.25rem; }
  .afeature__media { min-height: 13rem; }
  .afeature__body { padding: 2rem 0 2.2rem; }
}

@media (prefers-reduced-motion: reduce) {
  .afeature__media :deep(img),
  .afeature__title,
  .activities__view-all,
  .activities__view-all::after { transition: none; }
  .afeature:hover .afeature__media :deep(img) { transform: none; }
}
</style>
