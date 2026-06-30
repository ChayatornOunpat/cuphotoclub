<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface Member {
  id: number
  nickname: string
  photoR2Key: string | null
  schoolYear: number | null
  position: string | null
  instagram: string | null
}

const { t, locale } = useI18n()
const [{ data: members }, { data: pageData }] = await Promise.all([
  useFetch<Member[]>('/api/members'),
  useFetch<{ body: string }>('/api/pages/members')
])

const lead = computed(() => {
  try {
    const parsed = JSON.parse((pageData.value as any)?.body || '{}')
    return (locale.value === 'th' ? parsed.th : parsed.en) || t('members.lead')
  } catch {
    return t('members.lead')
  }
})

useSeoMeta({
  title: () => `${t('members.kicker')} — CU Photo Club`,
  description: () => lead.value
})

const staff = computed(() => members.value?.filter(m => m.position) ?? [])
const byYear = computed(() => {
  const regular = members.value?.filter(m => !m.position) ?? []
  const map = new Map<number | null, Member[]>()
  for (const m of regular) {
    const y = m.schoolYear
    if (!map.has(y)) map.set(y, [])
    map.get(y)!.push(m)
  }
  return [...map.entries()].sort((a, b) => {
    if (a[0] === null) return 1
    if (b[0] === null) return -1
    return a[0] - b[0]
  })
})

const expanded = ref<Set<number>>(new Set())
function toggle(id: number) {
  if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
  expanded.value = new Set(expanded.value)
}
</script>

<template>
  <div class="members-page">

    <!-- Page header -->
    <header class="page-head">
      <p class="page-head__kicker">{{ t('members.kicker') }}</p>
      <h1 class="page-head__title">{{ t('members.title') }}<br><em>{{ t('members.titleEm') }}</em></h1>
      <p class="page-head__lead">{{ lead }}</p>
    </header>

    <div class="members-body">

      <!-- Staff -->
      <template v-if="staff.length">
        <div class="eyebrow"><span class="num">01</span> {{ t('members.staff') }}</div>
        <div class="staff-grid">
          <button
            v-for="m in staff"
            :key="m.id"
            type="button"
            class="staff-card"
            :class="{ 'is-open': expanded.has(m.id) }"
            @click="toggle(m.id)"
          >
            <div class="staff-card__photo">
              <img v-if="m.photoR2Key" :src="`/images/${m.photoR2Key}`" :alt="m.nickname">
              <div v-else class="staff-card__initials">{{ m.nickname.slice(0, 1).toUpperCase() }}</div>
            </div>
            <div class="staff-card__body">
              <p class="staff-card__name">{{ m.nickname }}</p>
              <p class="staff-card__position">{{ m.position }}</p>
              <p v-if="m.schoolYear" class="staff-card__year">{{ t('members.year', { n: m.schoolYear }) }}</p>
              <Transition name="ig">
                <a
                  v-if="expanded.has(m.id) && m.instagram"
                  :href="`https://instagram.com/${m.instagram}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="staff-card__ig"
                  @click.stop
                >
                  <Icon name="simple-icons:instagram" />
                  @{{ m.instagram }}
                </a>
              </Transition>
            </div>
          </button>
        </div>
      </template>

      <!-- Members by year -->
      <template v-for="([year, group], i) in byYear" :key="year">
        <div class="eyebrow">
          <span class="num">{{ String(staff.length ? i + 2 : i + 1).padStart(2, '0') }}</span>
          {{ year ? t('members.year', { n: year }) : t('members.unspecified') }}
        </div>
        <div class="chips">
          <button
            v-for="m in group"
            :key="m.id"
            type="button"
            class="chip"
            :class="{ 'is-open': expanded.has(m.id) }"
            @click="toggle(m.id)"
          >
            <div class="chip__avatar">
              <img v-if="m.photoR2Key" :src="`/images/${m.photoR2Key}`" :alt="m.nickname">
              <span v-else>{{ m.nickname.slice(0, 1).toUpperCase() }}</span>
            </div>
            <span class="chip__name">{{ m.nickname }}</span>
            <Transition name="ig">
              <a
                v-if="expanded.has(m.id) && m.instagram"
                :href="`https://instagram.com/${m.instagram}`"
                target="_blank"
                rel="noopener noreferrer"
                class="chip__ig"
                @click.stop
              >
                <Icon name="simple-icons:instagram" />
                @{{ m.instagram }}
              </a>
            </Transition>
          </button>
        </div>
      </template>

      <!-- Empty -->
      <div v-if="!staff.length && !byYear.length" class="empty">
        <Icon name="heroicons:user-group" />
        <p>{{ t('members.empty') }}</p>
      </div>

    </div>
  </div>
</template>

<style scoped>
/* ── Layout ── */
.members-page {
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
.page-head__title em {
  font-style: italic;
  color: var(--accent);
}
.page-head__lead {
  font-size: 0.9rem;
  color: var(--muted);
  max-width: 480px;
  line-height: 1.8;
}

/* ── Body wrapper ── */
.members-body {
  max-width: 1380px;
  margin: 0 auto;
  padding: 4rem 3rem 8rem;
}

/* ── Staff grid ── */
.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1.5rem;
  margin-bottom: 5rem;
}

.staff-card {
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  padding: 0;
  transition: opacity 0.2s;
}
.staff-card:hover { opacity: 0.82; }

.staff-card__photo {
  aspect-ratio: 3 / 4;
  overflow: hidden;
  background: var(--paper);
  margin-bottom: 0.85rem;
}
.staff-card__photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.4s ease;
}
.staff-card:hover .staff-card__photo img { transform: scale(1.03); }

.staff-card__initials {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: 3rem;
  font-weight: 200;
  color: var(--subtle);
}

.staff-card__name {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 400;
  color: var(--dark);
  line-height: 1.2;
}
.staff-card__position {
  font-size: 0.6rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
  margin-top: 0.3rem;
}
.staff-card__year {
  font-size: 0.68rem;
  color: var(--muted);
  margin-top: 0.2rem;
}
.staff-card__ig {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: 0.6rem;
  font-size: 0.68rem;
  color: var(--muted);
  text-decoration: none;
  transition: color 0.15s;
}
.staff-card__ig:hover { color: var(--dark); }
.staff-card__ig svg,
.staff-card__ig :deep(svg) { width: 0.7rem; height: 0.7rem; }

/* ── Member chips ── */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 4rem;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.45rem 0.85rem 0.45rem 0.45rem;
  border: 1px solid var(--subtle);
  background: white;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.chip:hover,
.chip.is-open {
  border-color: var(--dark);
  box-shadow: 2px 2px 0 var(--dark);
}

.chip__avatar {
  width: 1.75rem;
  height: 1.75rem;
  overflow: hidden;
  background: var(--paper);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chip__avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.chip__avatar span { font-size: 0.6rem; font-weight: 500; color: var(--muted); }

.chip__name {
  font-size: 0.78rem;
  font-weight: 400;
  color: var(--dark);
  white-space: nowrap;
}

.chip__ig {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.62rem;
  color: var(--accent);
  text-decoration: none;
  white-space: nowrap;
  padding-left: 0.5rem;
  border-left: 1px solid var(--subtle);
}
.chip__ig:hover { text-decoration: underline; }
.chip__ig svg,
.chip__ig :deep(svg) { width: 0.6rem; height: 0.6rem; }

/* ── Empty state ── */
.empty {
  padding: 6rem 0;
  text-align: center;
  color: var(--muted);
}
.empty svg,
.empty :deep(svg) { width: 3rem; height: 3rem; opacity: 0.25; margin-bottom: 1rem; }
.empty p { font-size: 0.9rem; }

/* ── Instagram expand transition ── */
.ig-enter-active,
.ig-leave-active { transition: opacity 0.15s, transform 0.15s; }
.ig-enter-from,
.ig-leave-to { opacity: 0; transform: translateX(-6px); }

/* ── Responsive ── */
@media (max-width: 860px) {
  .page-head { padding: 8rem 1.5rem 3.5rem; }
  .members-body { padding: 3rem 1.5rem 6rem; }
  .staff-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; }
}
@media (max-width: 480px) {
  .page-head__title { font-size: clamp(2.4rem, 12vw, 3.5rem); }
  .staff-grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
}
</style>
