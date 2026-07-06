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

// Events overlapping the visible month, for the list under the calendar.
const monthEvents = computed(() => {
  const monthStart = new Date(Date.UTC(viewYear.value, viewMonth.value, 1))
  const monthEnd = new Date(Date.UTC(viewYear.value, viewMonth.value + 1, 0))
  return (events.value ?? [])
    .filter((ev) => {
      if (!ev.eventDate) return false
      const start = new Date(ev.eventDate)
      const end = ev.endDate ? new Date(ev.endDate) : start
      return start <= monthEnd && end >= monthStart
    })
    .sort((a, b) => new Date(a.eventDate!).getTime() - new Date(b.eventDate!).getTime())
})

const undatedEvents = computed(() => (events.value ?? []).filter(ev => !ev.eventDate))

function formatRange(ev: EventRow) {
  const fmt = new Intl.DateTimeFormat(intlLocale.value, { day: 'numeric', month: 'short', timeZone: 'UTC' })
  const start = fmt.format(new Date(ev.eventDate!))
  if (!ev.endDate || ev.endDate === ev.eventDate) return start
  return `${start} – ${fmt.format(new Date(ev.endDate))}`
}

function dayNumber(ev: EventRow) {
  return new Date(ev.eventDate!).getUTCDate()
}
function monthShort(ev: EventRow) {
  return new Intl.DateTimeFormat(intlLocale.value, { month: 'short', timeZone: 'UTC' }).format(new Date(ev.eventDate!))
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink">{{ t('activities.pageTitle') }}</h1>
      <p class="mt-3 text-ink-soft">{{ t('activities.pageLead') }}</p>
    </header>

    <!-- Calendar -->
    <section class="mt-10 overflow-hidden rounded-lg border border-line bg-white" :aria-label="t('activities.calendarLabel')">
      <div class="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 class="text-lg font-semibold capitalize text-ink">{{ monthTitle }}</h2>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-paper-soft hover:text-ink"
            :aria-label="t('activities.prevMonth')"
            @click="shiftMonth(-1)"
          >
            <Icon name="heroicons:chevron-left" class="size-5" />
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm text-ink-soft hover:bg-paper-soft hover:text-ink"
            @click="goToday"
          >
            {{ t('activities.today') }}
          </button>
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-md text-ink-soft hover:bg-paper-soft hover:text-ink"
            :aria-label="t('activities.nextMonth')"
            @click="shiftMonth(1)"
          >
            <Icon name="heroicons:chevron-right" class="size-5" />
          </button>
        </div>
      </div>

      <div class="grid grid-cols-7 border-b border-line bg-paper-soft text-center">
        <div v-for="label in weekdayLabels" :key="label" class="py-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
          {{ label }}
        </div>
      </div>

      <div class="grid grid-cols-7">
        <template v-for="(week, wi) in weeks" :key="wi">
          <div
            v-for="cell in week"
            :key="cell.key"
            class="min-h-16 border-b border-r border-line p-1 last:border-r-0 sm:min-h-24 sm:p-1.5 [&:nth-child(7n)]:border-r-0"
            :class="cell.inMonth ? 'bg-white' : 'bg-paper-soft/60'"
          >
            <span
              class="inline-flex size-6 items-center justify-center rounded-full text-xs sm:text-sm"
              :class="[
                cell.isToday ? 'bg-accent font-semibold text-white' : '',
                !cell.isToday && cell.inMonth ? 'text-ink' : '',
                !cell.isToday && !cell.inMonth ? 'text-ink-soft/50' : ''
              ]"
            >
              {{ cell.day }}
            </span>

            <!-- Pills on ≥sm, dots on mobile -->
            <div class="mt-0.5 hidden space-y-0.5 sm:block">
              <NuxtLink
                v-for="ev in cell.events.slice(0, 3)"
                :key="ev.id"
                :to="localePath(`/activities/${ev.slug}`)"
                class="block truncate rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent hover:bg-accent hover:text-white"
                :title="ev.title"
              >
                {{ ev.title }}
              </NuxtLink>
              <p v-if="cell.events.length > 3" class="px-1.5 text-xs text-ink-soft">
                {{ t('activities.moreCount', { count: cell.events.length - 3 }) }}
              </p>
            </div>
            <div v-if="cell.events.length" class="mt-1 flex justify-center gap-0.5 sm:hidden">
              <span v-for="ev in cell.events.slice(0, 3)" :key="ev.id" class="size-1.5 rounded-full bg-accent" />
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- Events in the visible month -->
    <section class="mt-10">
      <h2 class="text-xl font-semibold text-ink">{{ t('activities.monthEvents') }}</h2>

      <div v-if="monthEvents.length" class="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        <NuxtLink
          v-for="ev in monthEvents"
          :key="ev.id"
          :to="localePath(`/activities/${ev.slug}`)"
          class="group flex items-center gap-4 p-4 hover:bg-paper-soft"
        >
          <div class="flex w-14 shrink-0 flex-col items-center rounded-md border border-line py-1.5">
            <span class="text-lg font-bold leading-tight text-ink">{{ dayNumber(ev) }}</span>
            <span class="text-xs uppercase text-ink-soft">{{ monthShort(ev) }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-semibold text-ink group-hover:text-accent">{{ ev.title }}</h3>
            <p class="mt-0.5 truncate text-sm text-ink-soft">
              {{ formatRange(ev) }}<span v-if="ev.location"> · {{ ev.location }}</span>
            </p>
            <p v-if="ev.summary" class="mt-1 line-clamp-1 text-sm text-ink-soft">{{ ev.summary }}</p>
          </div>
          <img
            v-if="ev.coverR2Key"
            :src="`/images/${ev.coverR2Key}`"
            class="hidden h-16 w-24 shrink-0 rounded-md object-cover sm:block"
            alt=""
            loading="lazy"
          >
          <Icon name="heroicons:chevron-right" class="size-4 shrink-0 text-ink-soft/50" />
        </NuxtLink>
      </div>

      <div v-else class="mt-4 rounded-lg border border-dashed border-line bg-white p-10 text-center text-ink-soft">
        <Icon name="heroicons:calendar-days" class="mx-auto size-10 text-ink-soft/30" />
        <p class="mt-3 text-sm">{{ t('activities.emptyMonth') }}</p>
      </div>
    </section>

    <!-- Announced but not yet scheduled -->
    <section v-if="undatedEvents.length" class="mt-10">
      <h2 class="text-xl font-semibold text-ink">{{ t('activities.dateTba') }}</h2>
      <div class="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
        <NuxtLink
          v-for="ev in undatedEvents"
          :key="ev.id"
          :to="localePath(`/activities/${ev.slug}`)"
          class="group flex items-center gap-4 p-4 hover:bg-paper-soft"
        >
          <div class="flex size-12 shrink-0 items-center justify-center rounded-md border border-line text-ink-soft/50">
            <Icon name="heroicons:calendar" class="size-5" />
          </div>
          <div class="min-w-0 flex-1">
            <h3 class="truncate font-semibold text-ink group-hover:text-accent">{{ ev.title }}</h3>
            <p class="truncate text-sm text-ink-soft">{{ t('activities.comingSoon') }}<span v-if="ev.location"> · {{ ev.location }}</span></p>
          </div>
          <Icon name="heroicons:chevron-right" class="size-4 shrink-0 text-ink-soft/50" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
