<script setup lang="ts">
definePageMeta({ layout: 'site' })

interface Member {
  id: number
  nickname: string
  photoR2Key: string | null
  schoolYear: number | null
  position: string | null
  instagram: string | null
  bio: string | null
  interests: string[]
  featuredLinks: { label: string, url: string }[]
}

type PublicMemberFilter = 'all' | 'staff' | 'members' | `position:${string}`

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

const activeFilter = ref<PublicMemberFilter>('all')
const memberList = computed(() => members.value ?? [])
const positions = computed(() => [...new Set(memberList.value.map(m => m.position?.trim()).filter((position): position is string => !!position))].sort((a, b) => a.localeCompare(b, locale.value)))
const filterOptions = computed<{ value: PublicMemberFilter, label: string }[]>(() => [
  { value: 'all', label: t('members.filterAll') },
  { value: 'staff', label: t('members.filterStaff') },
  { value: 'members', label: t('members.filterMembers') },
  ...positions.value.map(position => ({ value: `position:${position}` as const, label: position }))
])

const visibleMembers = computed(() => memberList.value.filter((member) => {
  if (activeFilter.value === 'staff') return !!member.position
  if (activeFilter.value === 'members') return !member.position
  if (activeFilter.value.startsWith('position:')) return member.position?.trim() === activeFilter.value.slice(9)
  return true
}))

const staff = computed(() => [...visibleMembers.value.filter(m => m.position)].sort((a, b) => (a.position ?? '').localeCompare(b.position ?? '', locale.value)))
const regularMembers = computed(() => visibleMembers.value.filter(m => !m.position))

const selectedMember = ref<Member | null>(null)
const memberModalOpen = computed({
  get: () => !!selectedMember.value,
  set: (open) => {
    if (!open) selectedMember.value = null
  }
})

function openMember(member: Member) {
  selectedMember.value = member
}

function initialFor(member: Member) {
  return member.nickname.trim().slice(0, 1).toUpperCase()
}

function roleLabel(member: Member) {
  return member.position || t('members.member')
}

function hasProfileDetails(member: Member) {
  return !!member.bio || (member.interests?.length ?? 0) > 0 || (member.featuredLinks?.length ?? 0) > 0
}

function isExternalLink(url: string) {
  return /^https?:\/\//i.test(url)
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
      <nav class="member-filters" :aria-label="t('members.filtersLabel')">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="member-filter"
          :class="{ active: activeFilter === option.value }"
          :aria-pressed="activeFilter === option.value"
          @click="activeFilter = option.value"
        >
          {{ option.label }}
        </button>
      </nav>

      <!-- Staff -->
      <template v-if="staff.length">
        <div class="eyebrow"><span class="num">01</span> {{ t('members.staff') }}</div>
        <div class="staff-grid">
          <button
            v-for="m in staff"
            :key="m.id"
            type="button"
            class="staff-card"
            :aria-label="t('members.openProfile', { name: m.nickname })"
            @click="openMember(m)"
          >
            <div class="staff-card__photo">
              <img v-if="m.photoR2Key" :src="`/images/${m.photoR2Key}`" :alt="m.nickname">
              <div v-else class="staff-card__initials">{{ initialFor(m) }}</div>
            </div>
            <div class="staff-card__body">
              <p class="staff-card__name">{{ m.nickname }}</p>
              <p class="staff-card__position">{{ m.position }}</p>
            </div>
          </button>
        </div>
      </template>

      <!-- Members -->
      <template v-if="regularMembers.length">
        <div class="eyebrow">
          <span class="num">{{ staff.length ? '02' : '01' }}</span>
          {{ t('members.filterMembers') }}
        </div>
        <div class="chips">
          <button
            v-for="m in regularMembers"
            :key="m.id"
            type="button"
            class="chip"
            :aria-label="t('members.openProfile', { name: m.nickname })"
            @click="openMember(m)"
          >
            <div class="chip__avatar">
              <img v-if="m.photoR2Key" :src="`/images/${m.photoR2Key}`" :alt="m.nickname">
              <span v-else>{{ initialFor(m) }}</span>
            </div>
            <span class="chip__name">{{ m.nickname }}</span>
          </button>
        </div>
      </template>

      <!-- Empty -->
      <div v-if="!staff.length && !regularMembers.length" class="empty">
        <Icon name="heroicons:user-group" />
        <p>{{ t('members.empty') }}</p>
      </div>

    </div>

    <UiModal v-model="memberModalOpen" :title="t('members.profileTitle')" size="lg" flush>
      <article v-if="selectedMember" class="member-modal-card">
        <div class="member-modal-card__image">
          <img
            v-if="selectedMember.photoR2Key"
            :src="`/images/${selectedMember.photoR2Key}`"
            :alt="selectedMember.nickname"
          >
          <div v-else class="member-modal-card__initial">{{ initialFor(selectedMember) }}</div>
        </div>

        <div class="member-modal-card__content">
          <p class="member-modal-card__eyebrow">{{ t('members.profileEyebrow') }}</p>
          <h2 class="member-modal-card__name">{{ selectedMember.nickname }}</h2>

          <dl class="member-modal-card__meta">
            <div>
              <dt>{{ t('members.role') }}</dt>
              <dd>{{ roleLabel(selectedMember) }}</dd>
            </div>
          </dl>

          <p v-if="selectedMember.bio" class="member-modal-card__bio">{{ selectedMember.bio }}</p>

          <div v-if="selectedMember.interests?.length" class="member-modal-card__tags" :aria-label="t('members.interests')">
            <span v-for="interest in selectedMember.interests" :key="interest">{{ interest }}</span>
          </div>

          <div v-if="selectedMember.featuredLinks?.length" class="member-modal-card__work">
            <p>{{ t('members.featuredWork') }}</p>
            <a
              v-for="link in selectedMember.featuredLinks"
              :key="`${link.label}-${link.url}`"
              :href="link.url"
              :target="isExternalLink(link.url) ? '_blank' : undefined"
              :rel="isExternalLink(link.url) ? 'noopener noreferrer' : undefined"
            >
              {{ link.label }}
            </a>
          </div>

          <a
            v-if="selectedMember.instagram"
            :href="`https://instagram.com/${selectedMember.instagram}`"
            target="_blank"
            rel="noopener noreferrer"
            class="member-modal-card__link"
          >
            <Icon name="simple-icons:instagram" />
            <span>@{{ selectedMember.instagram }}</span>
          </a>
          <p v-else-if="!hasProfileDetails(selectedMember)" class="member-modal-card__note">{{ t('members.noInstagram') }}</p>
        </div>
      </article>
    </UiModal>
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

.member-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  margin-bottom: 4rem;
}

.member-filter {
  border: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  padding: 0.58rem 0.78rem;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.member-filter:hover,
.member-filter:focus-visible {
  border-color: var(--dark);
  color: var(--dark);
}
.member-filter:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 3px;
}
.member-filter.active {
  background: var(--dark);
  border-color: var(--dark);
  color: var(--body-bg);
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
.staff-card:hover,
.staff-card:focus-visible {
  opacity: 0.82;
}
.staff-card:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 0.45rem;
}

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
.chip:focus-visible {
  border-color: var(--dark);
  box-shadow: 2px 2px 0 var(--dark);
}
.chip:focus-visible { outline: 1px solid var(--accent); outline-offset: 3px; }

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

/* ── Empty state ── */
.empty {
  padding: 6rem 0;
  text-align: center;
  color: var(--muted);
}
.empty svg,
.empty :deep(svg) { width: 3rem; height: 3rem; opacity: 0.25; margin-bottom: 1rem; }
.empty p { font-size: 0.9rem; }

/* ── Profile modal card ── */
.member-modal-card {
  display: grid;
  grid-template-columns: minmax(220px, 0.82fr) minmax(0, 1fr);
  min-height: 28rem;
  background: var(--body-bg);
}

.member-modal-card__image {
  min-height: 28rem;
  background: var(--dark);
  overflow: hidden;
}

.member-modal-card__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.member-modal-card__initial {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-serif);
  font-size: clamp(5rem, 13vw, 9rem);
  font-weight: 200;
  color: color-mix(in srgb, var(--body-bg) 62%, transparent);
}

.member-modal-card__content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: clamp(2rem, 5vw, 4.5rem);
  border-left: 2px solid var(--accent);
}

.member-modal-card__eyebrow {
  font-size: 0.54rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}

.member-modal-card__name {
  font-family: var(--font-serif);
  font-size: clamp(2.8rem, 7vw, 6rem);
  font-weight: 200;
  line-height: 0.94;
  color: var(--dark);
  margin-bottom: 2rem;
  overflow-wrap: anywhere;
}

.member-modal-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-top: 1px solid var(--subtle);
  border-bottom: 1px solid var(--subtle);
  margin-bottom: 1.5rem;
}

.member-modal-card__meta div {
  padding: 1rem 1rem 1rem 0;
}

.member-modal-card__meta div + div {
  border-left: 1px solid var(--subtle);
  padding-left: 1rem;
}

.member-modal-card__meta dt {
  font-size: 0.5rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--muted);
  margin-bottom: 0.45rem;
}

.member-modal-card__meta dd {
  font-size: 0.86rem;
  line-height: 1.5;
  color: var(--dark);
}

.member-modal-card__link {
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border: 1px solid var(--dark);
  color: var(--dark);
  text-decoration: none;
  padding: 0.72rem 1rem;
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  transition: color 0.15s, border-color 0.15s;
}

.member-modal-card__link:hover,
.member-modal-card__link:focus-visible {
  color: var(--accent);
  border-color: var(--accent);
}

.member-modal-card__link :deep(svg) {
  width: 0.82rem;
  height: 0.82rem;
}

.member-modal-card__bio {
  color: var(--muted);
  font-size: 0.88rem;
  line-height: 1.75;
  margin-bottom: 1.4rem;
}

.member-modal-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 1.4rem;
}

.member-modal-card__tags span {
  border: 1px solid var(--subtle);
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  padding: 0.32rem 0.5rem;
}

.member-modal-card__work {
  display: grid;
  gap: 0.35rem;
  margin-bottom: 1.5rem;
}

.member-modal-card__work p {
  color: var(--accent);
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.member-modal-card__work a {
  color: var(--dark);
  font-size: 0.78rem;
  line-height: 1.5;
  text-decoration-color: color-mix(in srgb, var(--accent) 42%, transparent);
  text-underline-offset: 0.22em;
}
.member-modal-card__work a:hover {
  color: var(--accent);
}

.member-modal-card__note {
  font-size: 0.76rem;
  color: var(--muted);
}

/* ── Responsive ── */
@media (max-width: 860px) {
  .page-head { padding: 8rem 1.5rem 3.5rem; }
  .members-body { padding: 3rem 1.5rem 6rem; }
  .staff-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; }
  .member-modal-card {
    grid-template-columns: 1fr;
  }
  .member-modal-card__image {
    min-height: 0;
    aspect-ratio: 5 / 4;
  }
  .member-modal-card__content {
    border-left: 0;
    border-top: 2px solid var(--accent);
  }
}
@media (max-width: 480px) {
  .page-head__title { font-size: clamp(2.4rem, 12vw, 3.5rem); }
  .staff-grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .member-modal-card__meta {
    grid-template-columns: 1fr;
  }
  .member-modal-card__meta div + div {
    border-left: 0;
    border-top: 1px solid var(--subtle);
    padding-left: 0;
  }
}
</style>
