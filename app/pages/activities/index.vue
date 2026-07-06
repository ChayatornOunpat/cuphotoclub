<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface EventRow {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: string | null
  endDate: string | null
  location: string | null
}

interface DayCell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: EventRow[]
}

const { t, locale } = useI18n()
const localePath = useLocalePath()
const { data: events } = await useFetch<EventRow[]>('/api/events')

useSeoMeta({
  title: () => t('activities.pageTitle'),
  description: () => t('activities.pageLead')
})

// Event dates are stored as UTC midnight, so UTC getters recover the intended
// calendar day regardless of the viewer's timezone.
function utcKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}
function localKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const now = new Date()
const viewYear = ref(now.getFullYear())
const viewMonth = ref(now.getMonth()) // 0-based

function shiftMonth(delta: number) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
}
function goToday() {
  viewYear.value = now.getFullYear()
  viewMonth.value = now.getMonth()
}

const intlLocale = computed(() => (locale.value === 'th' ? 'th-TH' : 'en-GB'))

const monthTitle = computed(() =>
  new Intl.DateTimeFormat(intlLocale.value, { month: 'long', year: 'numeric' })
    .format(new Date(viewYear.value, viewMonth.value, 1))
)

const yearTitle = computed(() =>
  new Intl.DateTimeFormat(intlLocale.value, { year: 'numeric' })
    .format(new Date(viewYear.value, 6, 1))
)

// Sunday-first weekday header labels.
const weekdayLabels = computed(() => {
  const fmt = new Intl.DateTimeFormat(intlLocale.value, { weekday: 'short', timeZone: 'UTC' })
  // 2023-01-01 was a Sunday
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))))
})

// day key -> events occurring that day (multi-day events appear on every day of their span)
const eventsByDay = computed(() => {
  const map = new Map<string, EventRow[]>()
  for (const ev of events.value ?? []) {
    if (!ev.eventDate) continue
    const start = new Date(ev.eventDate)
    const end = ev.endDate ? new Date(ev.endDate) : start
    const cursor = new Date(start)
    for (let i = 0; i < 62 && cursor <= end; i++) {
      const key = utcKey(cursor)
      const list = map.get(key)
      if (list) list.push(ev)
      else map.set(key, [ev])
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  return map
})

const weeks = computed<DayCell[][]>(() => {
  const first = new Date(Date.UTC(viewYear.value, viewMonth.value, 1))
  const daysInMonth = new Date(Date.UTC(viewYear.value, viewMonth.value + 1, 0)).getUTCDate()
  const lead = first.getUTCDay() // Sunday-first offset
  const totalCells = Math.ceil((lead + daysInMonth) / 7) * 7
  const todayKey = localKey(new Date())

  const cells: DayCell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(Date.UTC(viewYear.value, viewMonth.value, 1 + i - lead))
    const key = utcKey(d)
    cells.push({
      key,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === viewMonth.value,
      isToday: key === todayKey,
      events: eventsByDay.value.get(key) ?? []
    })
  }
  const rows: DayCell[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
  return rows
})

// All dated events touching the calendar's current year, for the card grid.
const yearEvents = computed(() => {
  const yearStart = new Date(Date.UTC(viewYear.value, 0, 1))
  const yearEnd = new Date(Date.UTC(viewYear.value, 11, 31))
  return (events.value ?? [])
    .filter((ev) => {
      if (!ev.eventDate) return false
      const start = new Date(ev.eventDate)
      const end = ev.endDate ? new Date(ev.endDate) : start
      return start <= yearEnd && end >= yearStart
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
})

const undatedEvents = computed(() => (events.value ?? []).filter(ev => !ev.eventDate))

// ── Selected event (clicked on the calendar) ─────────────────────────────────
const selectedEvent = ref<EventRow | null>(null)
const selectedCardEl = ref<HTMLElement | null>(null)

function selectEvent(ev: EventRow) {
  selectedEvent.value = ev
  nextTick(() => selectedCardEl.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
}

// On mobile the chips collapse to dots, so tapping the day selects its first event.
function selectDay(cell: DayCell) {
  if (cell.events.length) selectEvent(cell.events[0]!)
}

function formatRange(ev: EventRow) {
  const fmt = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const start = fmt.format(new Date(ev.eventDate!))
  if (!ev.endDate || ev.endDate === ev.eventDate) return start
  return `${start} – ${fmt.format(new Date(ev.endDate))}`
}
</script>

<template>
  <div class="activities-page">

    <!-- Page header -->
    <header class="page-head">
      <p class="page-head__kicker">{{ t('activities.kicker') }}</p>
      <h1 class="page-head__title">{{ t('activities.pageTitle') }}</h1>
      <p class="page-head__lead">{{ t('activities.pageLead') }}</p>
    </header>

    <div class="activities-body">

      <!-- Calendar -->
      <div class="eyebrow"><span class="num">01</span> {{ t('activities.calendarLabel') }}</div>

      <section class="cal-section" :aria-label="t('activities.calendarLabel')">
        <div class="cal-section__grid">
        <div class="cal-section__cal">
        <div class="cal-toolbar">
          <h2 class="cal-toolbar__month">{{ monthTitle }}</h2>
          <div class="cal-toolbar__controls">
            <button type="button" class="cal-nav" :aria-label="t('activities.prevMonth')" @click="shiftMonth(-1)">
              <Icon name="heroicons:chevron-left" class="cal-nav__icon" />
            </button>
            <button type="button" class="cal-nav cal-nav--today" @click="goToday">{{ t('activities.today') }}</button>
            <button type="button" class="cal-nav" :aria-label="t('activities.nextMonth')" @click="shiftMonth(1)">
              <Icon name="heroicons:chevron-right" class="cal-nav__icon" />
            </button>
          </div>
        </div>

        <div class="cal">
          <div class="cal__weekdays">
            <span v-for="label in weekdayLabels" :key="label">{{ label }}</span>
          </div>
          <div v-for="(week, wi) in weeks" :key="wi" class="cal__week">
            <div
              v-for="cell in week"
              :key="cell.key"
              class="cal__day"
              :class="{ 'cal__day--out': !cell.inMonth, 'cal__day--today': cell.isToday, 'cal__day--has-events': cell.events.length }"
              @click="selectDay(cell)"
            >
              <span class="cal__num">{{ cell.day }}</span>

              <div class="cal__chips">
                <button
                  v-for="ev in cell.events.slice(0, 3)"
                  :key="ev.id"
                  type="button"
                  class="cal__chip"
                  :class="{ 'cal__chip--active': selectedEvent?.id === ev.id }"
                  :title="ev.title"
                  @click.stop="selectEvent(ev)"
                >
                  {{ ev.title }}
                </button>
                <p v-if="cell.events.length > 3" class="cal__more">
                  {{ t('activities.moreCount', { count: cell.events.length - 3 }) }}
                </p>
              </div>

              <div v-if="cell.events.length" class="cal__dots">
                <span v-for="ev in cell.events.slice(0, 3)" :key="ev.id" class="cal__dot" />
              </div>
            </div>
          </div>
        </div>
        </div>

        <!-- Card for the event clicked on the calendar -->
        <aside class="cal-section__side" :aria-label="t('activities.selectedEvent')">
        <article v-if="selectedEvent" ref="selectedCardEl" class="selected-card">
          <button type="button" class="selected-card__close" :aria-label="t('activities.close')" @click="selectedEvent = null">
            ×
          </button>
          <div v-if="selectedEvent.coverR2Key" class="selected-card__media">
            <img :src="`/images/${selectedEvent.coverR2Key}`" :alt="selectedEvent.title">
          </div>
          <div class="selected-card__body">
            <p class="selected-card__meta">
              <template v-if="selectedEvent.eventDate">{{ formatRange(selectedEvent) }}</template>
              <template v-else>{{ t('activities.comingSoon') }}</template>
              <span v-if="selectedEvent.location"> · {{ selectedEvent.location }}</span>
            </p>
            <h3 class="selected-card__title">{{ selectedEvent.title }}</h3>
            <p v-if="selectedEvent.summary" class="selected-card__summary">{{ selectedEvent.summary }}</p>
            <NuxtLink :to="localePath(`/activities/${selectedEvent.slug}`)" class="selected-card__link">
              {{ t('activities.viewEvent') }}
            </NuxtLink>
          </div>
        </article>
        <div v-else class="side-placeholder">
          <Icon name="heroicons:cursor-arrow-rays" />
          <p>{{ t('activities.selectHint') }}</p>
        </div>
        </aside>
        </div>
      </section>

      <!-- All event cards this year -->
      <div class="eyebrow"><span class="num">02</span> {{ t('activities.eventsInYear', { year: yearTitle }) }}</div>

      <section v-if="yearEvents.length" class="cards" :aria-label="t('activities.eventsInYear', { year: yearTitle })">
        <NuxtLink
          v-for="ev in yearEvents"
          :key="ev.id"
          :to="localePath(`/activities/${ev.slug}`)"
          class="card"
          :class="{ 'card--active': selectedEvent?.id === ev.id }"
        >
          <div class="card__media">
            <img v-if="ev.coverR2Key" :src="`/images/${ev.coverR2Key}`" :alt="ev.title" loading="lazy">
            <div v-else class="card__placeholder">
              <Icon name="heroicons:calendar-days" />
            </div>
          </div>
          <p class="card__meta">
            {{ formatRange(ev) }}<span v-if="ev.location"> · {{ ev.location }}</span>
          </p>
          <h3 class="card__title">{{ ev.title }}</h3>
          <p v-if="ev.summary" class="card__summary">{{ ev.summary }}</p>
        </NuxtLink>
      </section>

      <div v-else class="empty">
        <Icon name="heroicons:calendar-days" />
        <p>{{ t('activities.emptyYear', { year: yearTitle }) }}</p>
      </div>

      <!-- Announced but not yet scheduled -->
      <template v-if="undatedEvents.length">
        <div class="eyebrow"><span class="num">03</span> {{ t('activities.dateTba') }}</div>
        <section class="cards" :aria-label="t('activities.dateTba')">
          <NuxtLink
            v-for="ev in undatedEvents"
            :key="ev.id"
            :to="localePath(`/activities/${ev.slug}`)"
            class="card"
          >
            <div class="card__media">
              <img v-if="ev.coverR2Key" :src="`/images/${ev.coverR2Key}`" :alt="ev.title" loading="lazy">
              <div v-else class="card__placeholder">
                <Icon name="heroicons:calendar" />
              </div>
            </div>
            <p class="card__meta">
              {{ t('activities.comingSoon') }}<span v-if="ev.location"> · {{ ev.location }}</span>
            </p>
            <h3 class="card__title">{{ ev.title }}</h3>
            <p v-if="ev.summary" class="card__summary">{{ ev.summary }}</p>
          </NuxtLink>
        </section>
      </template>

    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.activities-page {
  min-height: 100vh;
}

/* ── Page header ── */
.page-head {
  padding: 10rem 3rem 5rem;
  max-width: 1380px;
  margin: 0 auto;
  border-bottom: 1px solid var(--subtle);
}
.page-head__kicker {
  font-size: 0.54rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.5rem;
}
.page-head__title {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7vw, 7rem);
  font-weight: 200;
  line-height: 0.98;
  letter-spacing: -0.01em;
  color: var(--dark);
  margin-bottom: 1.5rem;
}
.page-head__lead {
  font-size: 0.9rem;
  color: var(--muted);
  max-width: 480px;
  line-height: 1.8;
}

/* ── Body wrapper ── */
.activities-body {
  max-width: 1380px;
  margin: 0 auto;
  padding: 4rem 3rem 8rem;
}

/* ── Calendar toolbar ── */
.cal-section {
  margin-bottom: 5rem;
}

/* Desktop: compact calendar on the left, selected event on the right */
.cal-section__grid {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
  gap: 2.5rem;
  align-items: start;
}

.cal-section__side {
  position: sticky;
  top: 5.5rem;
}

.cal-toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.cal-toolbar__month {
  font-family: var(--font-serif);
  font-size: clamp(1.4rem, 2.2vw, 1.9rem);
  font-weight: 200;
  color: var(--dark);
  text-transform: capitalize;
}

.cal-toolbar__controls {
  display: flex;
  border: 1px solid var(--subtle);
}

.cal-nav {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 2.4rem;
  border: 0;
  border-left: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  padding: 0.55rem 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cal-nav:first-child { border-left: 0; }
.cal-nav:hover {
  background: var(--dark);
  color: #F5F4F0;
}
.cal-nav__icon {
  width: 0.85rem;
  height: 0.85rem;
}

/* ── Calendar grid ── */
.cal {
  border: 1px solid var(--subtle);
  border-bottom: 0;
}

.cal__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-bottom: 1px solid var(--subtle);
  background: color-mix(in srgb, var(--paper) 45%, transparent);
}
.cal__weekdays span {
  padding: 0.45rem;
  color: var(--muted);
  font-size: 0.46rem;
  font-weight: 500;
  letter-spacing: 0.22em;
  text-align: center;
  text-transform: uppercase;
}

.cal__week {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
}

.cal__day {
  min-height: 4.6rem;
  padding: 0.3rem;
  border-right: 1px solid var(--subtle);
  border-bottom: 1px solid var(--subtle);
}
.cal__day:last-child { border-right: 0; }
.cal__day--out {
  background: color-mix(in srgb, var(--paper) 40%, transparent);
}
.cal__day--out .cal__num { opacity: 0.38; }

.cal__num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  color: var(--dark);
  font-size: 0.62rem;
}
.cal__day--today .cal__num {
  background: var(--accent);
  border-radius: 50%;
  color: #fff;
  font-weight: 500;
}

.cal__chips {
  margin-top: 0.15rem;
}

.cal__chip {
  display: block;
  width: 100%;
  margin-top: 0.18rem;
  border: 0;
  border-left: 2px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  color: var(--dark);
  padding: 0.18rem 0.32rem;
  font-family: var(--font-sans);
  font-size: 0.55rem;
  line-height: 1.3;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cal__chip:hover,
.cal__chip--active {
  background: var(--accent);
  color: #fff;
}

.cal__more {
  margin-top: 0.2rem;
  padding: 0 0.32rem;
  color: var(--muted);
  font-size: 0.52rem;
}

.cal__dots {
  display: none;
}

/* ── Selected event card ── */
.selected-card {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--subtle);
  border-top: 2px solid var(--accent);
  background: color-mix(in srgb, var(--paper) 30%, transparent);
}

.selected-card__close {
  position: absolute;
  top: 0.5rem;
  right: 0.6rem;
  border: 0;
  background: none;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: color 0.15s;
}
.selected-card__close:hover { color: var(--dark); }

.selected-card__media {
  width: 100%;
  aspect-ratio: 3 / 2;
  flex-shrink: 0;
  overflow: hidden;
  background: var(--paper);
}
.selected-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.selected-card__body {
  flex: 1;
  min-width: 0;
  padding: 1.3rem 2.2rem 1.5rem 1.4rem;
}

/* Placeholder shown until an event is picked */
.side-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.9rem;
  min-height: 14rem;
  padding: 2.5rem 1.5rem;
  border: 1px dashed var(--subtle);
  text-align: center;
  color: var(--muted);
}
.side-placeholder svg,
.side-placeholder :deep(svg) {
  width: 1.8rem;
  height: 1.8rem;
  opacity: 0.45;
}
.side-placeholder p {
  max-width: 16rem;
  font-size: 0.72rem;
  line-height: 1.7;
}

.selected-card__meta {
  font-size: 0.6rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.selected-card__title {
  margin-top: 0.5rem;
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 300;
  line-height: 1.2;
  color: var(--dark);
}

.selected-card__summary {
  margin-top: 0.6rem;
  font-size: 0.8rem;
  line-height: 1.7;
  color: var(--muted);
}

.selected-card__link {
  display: inline-block;
  margin-top: 1rem;
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dark);
  text-decoration: none;
  border-bottom: 1px solid var(--accent);
  padding-bottom: 0.2rem;
  transition: color 0.15s;
}
.selected-card__link:hover { color: var(--accent); }

/* ── Event cards ── */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 2rem 1.5rem;
  margin-bottom: 5rem;
}

.card {
  display: block;
  text-decoration: none;
  transition: opacity 0.2s;
}
.card:hover { opacity: 0.85; }
.card--active .card__title { color: var(--accent); }

.card__media {
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: var(--paper);
  margin-bottom: 0.9rem;
}
.card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.card:hover .card__media img { transform: scale(1.03); }

.card__placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--subtle);
}
.card__placeholder svg,
.card__placeholder :deep(svg) {
  width: 2rem;
  height: 2rem;
}

.card__meta {
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.card__title {
  margin-top: 0.4rem;
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 400;
  line-height: 1.25;
  color: var(--dark);
  transition: color 0.15s;
}
.card:hover .card__title { color: var(--accent); }

.card__summary {
  margin-top: 0.4rem;
  font-size: 0.76rem;
  line-height: 1.65;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Empty state ── */
.empty {
  border: 1px dashed var(--subtle);
  padding: 4rem 2rem;
  margin-bottom: 5rem;
  text-align: center;
  color: var(--muted);
}
.empty svg,
.empty :deep(svg) {
  width: 2.2rem;
  height: 2.2rem;
  opacity: 0.4;
}
.empty p {
  margin-top: 0.9rem;
  font-size: 0.78rem;
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .page-head {
    padding: 7rem 1.25rem 3rem;
  }
  .activities-body {
    padding: 2.5rem 1.25rem 5rem;
  }

  .cal-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .cal__day {
    min-height: 3.4rem;
    padding: 0.25rem;
  }
  .cal__day--has-events { cursor: pointer; }
  .cal__num {
    width: 1.3rem;
    height: 1.3rem;
    font-size: 0.62rem;
  }
  .cal__chips { display: none; }
  .cal__dots {
    display: flex;
    justify-content: center;
    gap: 0.2rem;
    margin-top: 0.2rem;
  }
  .cal__dot {
    width: 0.32rem;
    height: 0.32rem;
    border-radius: 50%;
    background: var(--accent);
  }

  .cal-section__grid {
    display: block;
  }
  .cal-section__side {
    position: static;
    margin-top: 1.5rem;
  }
  .side-placeholder {
    display: none;
  }
  .selected-card__body {
    padding: 1.1rem 2.2rem 1.3rem 1.1rem;
  }

  .cards {
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem 1rem;
  }
}
</style>
