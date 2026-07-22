<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
useHead({ title: () => t('adminMembers.title') })

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
  active: boolean
  sortOrder: number
}

type MemberFilter = 'all' | 'staff' | 'members' | 'hidden'

const { data: pageData, refresh: refreshPage } = await useFetch<{ title: string, bodyHtml: string, body?: string }>('/api/admin/pages/members')
const { data: members, refresh, pending } = await useFetch<Member[]>('/api/admin/members')

const intro = reactive({ en: '', th: '' })
const introSaving = ref(false)
const introMsg = ref('')

watchEffect(() => {
  if (!pageData.value) return
  try {
    const parsed = JSON.parse(pageData.value.body || '{}')
    intro.en = parsed.en || ''
    intro.th = parsed.th || ''
  } catch {
    intro.en = ''
    intro.th = ''
  }
})

const showForm = ref(false)
const editing = ref<Member | null>(null)
const saving = ref(false)
const formError = ref('')
const confirmTarget = ref<Member | null>(null)
const deleting = ref(false)
const activeFilter = ref<MemberFilter>('all')
const draggingId = ref<number | null>(null)
const dragOverId = ref<number | null>(null)
const reorderSaving = ref(false)
const reorderMsg = ref('')

const form = reactive({
  nickname: '',
  schoolYear: '',
  position: '',
  instagram: '',
  bio: '',
  interests: '',
  featuredLinks: '',
  photoR2Key: null as string | null,
  sortOrder: '0',
  active: true
})

const memberList = computed(() => members.value ?? [])
const activeCount = computed(() => memberList.value.filter(m => m.active).length)
const staffCount = computed(() => memberList.value.filter(m => !!m.position).length)
const regularCount = computed(() => memberList.value.filter(m => !m.position).length)
const hiddenCount = computed(() => memberList.value.filter(m => !m.active).length)

const orderedMembers = computed(() => [...memberList.value].sort((a, b) => {
  if (a.active !== b.active) return a.active ? -1 : 1
  if (!!a.position !== !!b.position) return a.position ? -1 : 1
  if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
  return a.nickname.localeCompare(b.nickname, 'th')
}))

const visibleMembers = computed(() => orderedMembers.value.filter((m) => {
  if (activeFilter.value === 'staff') return !!m.position
  if (activeFilter.value === 'members') return !m.position
  if (activeFilter.value === 'hidden') return !m.active
  return true
}))

const filterOptions = computed<{ value: MemberFilter, label: string, count: number }[]>(() => [
  { value: 'all', label: t('adminMembers.filterAll'), count: memberList.value.length },
  { value: 'staff', label: t('adminMembers.filterStaff'), count: staffCount.value },
  { value: 'members', label: t('adminMembers.filterMembers'), count: regularCount.value },
  { value: 'hidden', label: t('adminMembers.filterHidden'), count: hiddenCount.value }
])

function resetForm() {
  Object.assign(form, {
    nickname: '',
    schoolYear: '',
    position: '',
    instagram: '',
    bio: '',
    interests: '',
    featuredLinks: '',
    photoR2Key: null,
    sortOrder: '0',
    active: true
  })
}

function openCreate() {
  editing.value = null
  resetForm()
  formError.value = ''
  showForm.value = true
}

function openEdit(member: Member) {
  editing.value = member
  Object.assign(form, {
    nickname: member.nickname,
    schoolYear: member.schoolYear ? String(member.schoolYear) : '',
    position: member.position ?? '',
    instagram: member.instagram ?? '',
    bio: member.bio ?? '',
    interests: (member.interests ?? []).join(', '),
    featuredLinks: linksToText(member.featuredLinks ?? []),
    photoR2Key: member.photoR2Key,
    sortOrder: String(member.sortOrder ?? 0),
    active: member.active
  })
  formError.value = ''
  showForm.value = true
}

function errMsg(e: unknown) {
  const err = e as { data?: { message?: string, statusMessage?: string } }
  return err?.data?.message || err?.data?.statusMessage || t('adminMembers.saveFailed')
}

function bodyFromForm() {
  return {
    nickname: form.nickname.trim(),
    schoolYear: form.schoolYear ? Number(form.schoolYear) : null,
    position: form.position.trim() || null,
    instagram: form.instagram.replace(/^@/, '').trim() || null,
    bio: form.bio.trim() || null,
    interests: form.interests
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
      .slice(0, 12),
    featuredLinks: textToLinks(form.featuredLinks),
    photoR2Key: form.photoR2Key,
    sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
    active: form.active
  }
}

async function saveIntro() {
  introSaving.value = true
  introMsg.value = ''
  try {
    await $fetch('/api/admin/pages/members', {
      method: 'PUT',
      body: { title: 'Members', body: JSON.stringify({ en: intro.en, th: intro.th }) }
    })
    introMsg.value = t('adminSettings.saved')
    await refreshPage()
  } catch {
    introMsg.value = t('adminMembers.saveFailed')
  } finally {
    introSaving.value = false
  }
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const body = bodyFromForm()
    if (editing.value) {
      await $fetch(`/api/admin/members/${editing.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/admin/members', { method: 'POST', body })
    }
    showForm.value = false
    await refresh()
  } catch (e) {
    formError.value = errMsg(e)
  } finally {
    saving.value = false
  }
}

async function toggleActive(member: Member) {
  try {
    await $fetch(`/api/admin/members/${member.id}`, { method: 'PATCH', body: { active: !member.active } })
    await refresh()
  } catch (e) {
    alert(errMsg(e))
  }
}

async function doDelete() {
  if (!confirmTarget.value) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/members/${confirmTarget.value.id}`, { method: 'DELETE' })
    confirmTarget.value = null
    await refresh()
  } catch (e) {
    alert(errMsg(e))
  } finally {
    deleting.value = false
  }
}

function initialFor(member: Member) {
  return member.nickname.trim().slice(0, 1).toUpperCase()
}

function yearLabel(year: number | null) {
  return year ? t('adminMembers.yearN', { n: year }) : t('adminMembers.unspecified')
}

function roleLabel(member: Member) {
  return member.position || t('adminMembers.filterMembers')
}

function dragStart(member: Member) {
  draggingId.value = member.id
  dragOverId.value = null
  reorderMsg.value = ''
}

function dragOver(member: Member) {
  if (draggingId.value === null || draggingId.value === member.id) return
  dragOverId.value = member.id
}

function clearDragState() {
  draggingId.value = null
  dragOverId.value = null
}

function reorderLocalMembers(nextVisible: Member[]) {
  if (!members.value) return
  const byId = new Map(nextVisible.map((member, index) => [member.id, { member, sortOrder: index }]))
  members.value = members.value.map((member) => {
    const next = byId.get(member.id)
    return next ? { ...next.member, sortOrder: next.sortOrder } : member
  })
}

async function dropOn(member: Member) {
  if (draggingId.value === null || draggingId.value === member.id) {
    clearDragState()
    return
  }

  const current = visibleMembers.value
  const from = current.findIndex(item => item.id === draggingId.value)
  const to = current.findIndex(item => item.id === member.id)
  if (from < 0 || to < 0) {
    clearDragState()
    return
  }

  const nextVisible = [...current]
  const [moved] = nextVisible.splice(from, 1)
  if (!moved) {
    clearDragState()
    return
  }
  nextVisible.splice(to, 0, moved)
  clearDragState()
  reorderLocalMembers(nextVisible)

  reorderSaving.value = true
  reorderMsg.value = ''
  try {
    await Promise.all(nextVisible.map((item, index) => (
      $fetch(`/api/admin/members/${item.id}`, { method: 'PATCH', body: { sortOrder: index } })
    )))
    reorderMsg.value = t('adminMembers.reorderSaved')
    await refresh()
  } catch (e) {
    reorderMsg.value = errMsg(e)
    await refresh()
  } finally {
    reorderSaving.value = false
  }
}

function linksToText(links: { label: string, url: string }[]) {
  return links.map(link => `${link.label} | ${link.url}`).join('\n')
}

function textToLinks(value: string) {
  return value
    .split('\n')
    .map((line) => {
      const [label, ...urlParts] = line.split('|')
      return { label: label?.trim() ?? '', url: urlParts.join('|').trim() }
    })
    .filter(link => link.label && link.url)
    .slice(0, 6)
}
</script>

<template>
  <div class="members-admin">
    <header class="page-head">
      <div>
        <NuxtLink to="/admin" class="back">Dashboard</NuxtLink>
        <h1>{{ t('adminMembers.title') }}</h1>
        <p>{{ t('adminMembers.lead') }}</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="btn-icon" />
        {{ t('adminMembers.addMember') }}
      </UiButton>
    </header>

    <section class="overview" aria-label="Member overview">
      <div class="metric">
        <span>{{ memberList.length }}</span>
        <p>{{ t('adminMembers.filterAll') }}</p>
      </div>
      <div class="metric">
        <span>{{ activeCount }}</span>
        <p>{{ t('adminMembers.shown') }}</p>
      </div>
      <div class="metric">
        <span>{{ staffCount }}</span>
        <p>{{ t('adminMembers.filterStaff') }}</p>
      </div>
      <div class="metric">
        <span>{{ hiddenCount }}</span>
        <p>{{ t('adminMembers.filterHidden') }}</p>
      </div>
    </section>

    <section class="intro-panel" aria-label="Public members page intro">
      <div class="section-head">
        <div>
          <p class="kicker">Public Page</p>
          <h2>{{ t('adminMembers.introHeading') }}</h2>
        </div>
        <div class="intro-actions">
          <span v-if="introMsg" class="save-state">{{ introMsg }}</span>
          <UiButton size="sm" :loading="introSaving" @click="saveIntro">{{ t('adminMembers.saveIntro') }}</UiButton>
        </div>
      </div>

      <div class="intro-grid">
        <label class="form-field" for="intro-th">
          <span>{{ t('adminMembers.thai') }}</span>
          <input id="intro-th" v-model="intro.th" type="text" :placeholder="t('adminMembers.introPlaceholderTh')">
        </label>
        <label class="form-field" for="intro-en">
          <span>English</span>
          <input id="intro-en" v-model="intro.en" type="text" placeholder="The staff and members who make up CU Photo.">
        </label>
      </div>
    </section>

    <section class="directory" aria-label="Members directory">
      <div class="directory-top">
        <div>
          <p class="kicker">Directory</p>
          <h2>{{ t('adminMembers.directoryHeading') }}</h2>
          <p class="directory-hint">{{ t('adminMembers.reorderHint') }}</p>
        </div>
        <div class="filters" role="tablist" aria-label="Member filters">
          <button
            v-for="option in filterOptions"
            :key="option.value"
            type="button"
            class="filter-btn"
            :class="{ active: activeFilter === option.value }"
            role="tab"
            :aria-selected="activeFilter === option.value"
            @click="activeFilter = option.value"
          >
            <span>{{ option.label }}</span>
            <b>{{ option.count }}</b>
          </button>
        </div>
      </div>
      <p v-if="reorderMsg || reorderSaving" class="reorder-state">
        {{ reorderSaving ? t('adminMembers.reorderSaving') : reorderMsg }}
      </p>

      <div class="table-wrap">
        <table v-if="visibleMembers.length" class="members-table">
          <thead>
            <tr>
              <th class="drag-head">{{ t('adminMembers.colReorder') }}</th>
              <th>{{ t('adminMembers.colMember') }}</th>
              <th>{{ t('adminMembers.colType') }}</th>
              <th>{{ t('adminMembers.colYear') }}</th>
              <th>Instagram</th>
              <th>{{ t('adminMembers.colOrder') }}</th>
              <th>{{ t('adminMembers.colStatus') }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="member in visibleMembers"
              :key="member.id"
              :class="{
                'is-hidden': !member.active,
                'is-dragging': draggingId === member.id,
                'is-drag-over': dragOverId === member.id
              }"
              @dragover.prevent="dragOver(member)"
              @dragleave="dragOverId = dragOverId === member.id ? null : dragOverId"
              @drop.prevent="dropOn(member)"
              @dragend="clearDragState"
            >
              <td :data-label="t('adminMembers.colReorder')" class="drag-cell">
                <button
                  type="button"
                  class="drag-handle"
                  draggable="true"
                  :aria-label="t('adminMembers.dragMember', { name: member.nickname })"
                  :title="t('adminMembers.dragToReorder')"
                  @dragstart="dragStart(member)"
                >
                  <Icon name="heroicons:bars-3" class="drag-handle__icon" />
                </button>
              </td>
              <td :data-label="t('adminMembers.colMember')">
                <div class="member-cell">
                  <span class="avatar">
                    <img v-if="member.photoR2Key" :src="`/images/${member.photoR2Key}`" alt="">
                    <template v-else>{{ initialFor(member) }}</template>
                  </span>
                  <div class="member-cell__copy">
                    <strong>{{ member.nickname }}</strong>
                    <span>ID {{ member.id }}</span>
                  </div>
                </div>
              </td>
              <td :data-label="t('adminMembers.colType')">
                <span class="pill" :class="member.position ? 'pill--staff' : 'pill--member'">{{ roleLabel(member) }}</span>
              </td>
              <td :data-label="t('adminMembers.colYear')" class="muted">{{ yearLabel(member.schoolYear) }}</td>
              <td data-label="Instagram" class="muted">
                <a v-if="member.instagram" :href="`https://instagram.com/${member.instagram}`" target="_blank" rel="noopener noreferrer">@{{ member.instagram }}</a>
                <span v-else>—</span>
              </td>
              <td :data-label="t('adminMembers.colOrder')" class="muted">{{ member.sortOrder }}</td>
              <td :data-label="t('adminMembers.colStatus')">
                <span class="pill" :class="member.active ? 'pill--active' : 'pill--hidden'">{{ member.active ? t('adminMembers.statusShown') : t('adminMembers.filterHidden') }}</span>
              </td>
              <td class="actions-cell">
                <div class="row-actions" :aria-label="`Actions for ${member.nickname}`">
                  <button type="button" class="icon-btn" :title="t('admin.edit')" @click="openEdit(member)">
                    <Icon name="heroicons:pencil-square" class="icon-btn__icon" />
                  </button>
                  <button type="button" class="icon-btn" :title="member.active ? t('adminMembers.filterHidden') : t('adminMembers.statusShown')" @click="toggleActive(member)">
                    <Icon :name="member.active ? 'heroicons:eye-slash' : 'heroicons:eye'" class="icon-btn__icon" />
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" :title="t('admin.delete')" @click="confirmTarget = member">
                    <Icon name="heroicons:trash" class="icon-btn__icon" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else-if="pending" class="empty">{{ t('adminMembers.loading') }}</p>
        <p v-else class="empty">{{ t('adminMembers.emptyView') }}</p>
      </div>
    </section>

    <UiModal v-model="showForm" :title="editing ? t('adminMembers.editMember') : t('adminMembers.addMember')" size="lg">
      <form class="member-form" @submit.prevent="save">
        <p v-if="formError" class="form-error">{{ formError }}</p>

        <div class="form-layout">
          <div class="photo-field">
            <span>{{ t('adminMembers.profilePhoto') }}</span>
            <AdminCoverUploader v-model="form.photoR2Key" prefix="members/photos" aspect="aspect-square" />
          </div>

          <div class="fields-grid">
            <label class="form-field" for="m-nick">
              <span>{{ t('adminMembers.nickname') }}</span>
              <input id="m-nick" v-model="form.nickname" type="text" required :placeholder="t('adminMembers.nicknamePlaceholder')">
            </label>

            <label class="form-field" for="m-year">
              <span>{{ t('adminMembers.colYear') }}</span>
              <select id="m-year" v-model="form.schoolYear">
                <option value="">{{ t('adminMembers.unspecified') }}</option>
                <option value="1">{{ t('adminMembers.yearN', { n: 1 }) }}</option>
                <option value="2">{{ t('adminMembers.yearN', { n: 2 }) }}</option>
                <option value="3">{{ t('adminMembers.yearN', { n: 3 }) }}</option>
                <option value="4">{{ t('adminMembers.yearN', { n: 4 }) }}</option>
              </select>
            </label>

            <label class="form-field" for="m-pos">
              <span>{{ t('adminMembers.position') }}</span>
              <input id="m-pos" v-model="form.position" type="text" :placeholder="t('adminMembers.positionPlaceholder')">
            </label>

            <label class="form-field" for="m-ig">
              <span>Instagram</span>
              <input id="m-ig" v-model="form.instagram" type="text" placeholder="username">
            </label>

            <label class="form-field" for="m-order">
              <span>{{ t('adminMembers.colOrder') }}</span>
              <input id="m-order" v-model="form.sortOrder" type="number" inputmode="numeric">
            </label>

            <label class="check-field">
              <input v-model="form.active" type="checkbox">
              <span>{{ t('adminMembers.showOnPage') }}</span>
            </label>

            <label class="form-field fields-grid__wide" for="m-bio">
              <span>{{ t('adminMembers.bio') }}</span>
              <textarea id="m-bio" v-model="form.bio" rows="3" :placeholder="t('adminMembers.bioPlaceholder')" />
            </label>

            <label class="form-field fields-grid__wide" for="m-interests">
              <span>{{ t('adminMembers.interests') }}</span>
              <input id="m-interests" v-model="form.interests" type="text" :placeholder="t('adminMembers.interestsPlaceholder')">
            </label>

            <label class="form-field fields-grid__wide" for="m-links">
              <span>{{ t('adminMembers.featuredLinks') }}</span>
              <textarea id="m-links" v-model="form.featuredLinks" rows="3" :placeholder="t('adminMembers.featuredLinksPlaceholder')" />
            </label>
          </div>
        </div>

        <div class="form-actions">
          <UiButton type="button" variant="secondary" @click="showForm = false">{{ t('admin.cancel') }}</UiButton>
          <UiButton type="submit" :loading="saving">{{ t('admin.save') }}</UiButton>
        </div>
      </form>
    </UiModal>

    <UiModal
      :model-value="!!confirmTarget"
      :title="t('adminMembers.deleteMember')"
      @update:model-value="v => { if (!v) confirmTarget = null }"
    >
      <p class="confirm-text">
        {{ t('adminMembers.deleteConfirmPrefix') }} <strong>{{ confirmTarget?.nickname }}</strong> {{ t('adminUsers.deleteConfirmSuffix') }}
      </p>
      <div class="form-actions form-actions--confirm">
        <UiButton variant="secondary" @click="confirmTarget = null">{{ t('admin.cancel') }}</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="doDelete">{{ t('admin.delete') }}</UiButton>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.members-admin {
  max-width: 1180px;
  margin: 0 auto;
  padding: 3rem 2rem 5rem;
}

.page-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.5rem;
  margin-bottom: 2.25rem;
}

.back {
  display: inline-block;
  margin-bottom: 0.65rem;
  color: var(--muted);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  text-decoration: none;
}
.back:hover { color: var(--accent); }

.page-head h1 {
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: clamp(3rem, 6.6vw, 6rem);
  font-weight: 200;
  line-height: 0.95;
}

.page-head p {
  max-width: 620px;
  margin-top: 0.75rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.7;
}

.btn-icon {
  width: 0.85rem;
  height: 0.85rem;
}

.overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-top: 2px solid var(--accent);
  border-bottom: 1px solid var(--subtle);
  margin-bottom: 2rem;
}

.metric {
  padding: 1rem 1.1rem;
  border-left: 1px solid var(--subtle);
}
.metric:first-child { border-left: 0; }
.metric span {
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: 2.2rem;
  font-weight: 200;
  line-height: 1;
}
.metric p {
  margin-top: 0.35rem;
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.intro-panel,
.directory {
  margin-top: 2rem;
  border-top: 1px solid var(--subtle);
}

.section-head,
.directory-top {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.1rem 0;
}

.kicker {
  color: var(--accent);
  font-size: 0.52rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.section-head h2,
.directory-top h2 {
  margin-top: 0.28rem;
  color: var(--dark);
  font-family: var(--font-serif);
  font-size: 1.7rem;
  font-weight: 200;
}

.directory-hint {
  margin-top: 0.35rem;
  max-width: 32rem;
  color: var(--muted);
  font-size: 0.68rem;
  line-height: 1.6;
}

.reorder-state {
  margin: -0.2rem 0 0.85rem;
  color: var(--muted);
  font-size: 0.62rem;
}

.intro-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.save-state {
  color: var(--muted);
  font-size: 0.62rem;
}

.intro-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
  padding-bottom: 1rem;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  border: 1px solid var(--subtle);
}

.filter-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 0;
  border-left: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  padding: 0.55rem 0.75rem;
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  cursor: pointer;
}
.filter-btn:first-child { border-left: 0; }
.filter-btn b {
  color: inherit;
  font-weight: 500;
}
.filter-btn.active {
  background: var(--dark);
  color: #F5F4F0;
}
.filter-btn.active b { color: var(--accent); }

.table-wrap {
  overflow-x: auto;
  scrollbar-width: thin;
}

.members-table {
  width: 100%;
  border-collapse: collapse;
}

.members-table th {
  padding: 0.75rem 0.8rem;
  border-bottom: 1px solid var(--subtle);
  color: var(--muted);
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.members-table td {
  padding: 0.9rem 0.8rem;
  border-bottom: 1px solid var(--subtle);
  color: var(--dark);
  font-size: 0.76rem;
  vertical-align: middle;
}

.members-table tbody tr {
  transition: background 0.15s;
}
.members-table tbody tr:hover {
  background: color-mix(in srgb, var(--paper) 38%, transparent);
}
.members-table tbody tr.is-dragging {
  opacity: 0.38;
}
.members-table tbody tr.is-drag-over {
  background: color-mix(in srgb, var(--accent) 9%, transparent);
  box-shadow: inset 0 2px 0 var(--accent);
}
.members-table tbody tr.is-hidden {
  opacity: 0.64;
}

.drag-head {
  width: 2.8rem;
}

.drag-cell {
  width: 2.8rem;
  padding-right: 0.25rem;
}

.drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.8rem;
  height: 1.8rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: grab;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.drag-handle:hover {
  border-color: var(--subtle);
  background: color-mix(in srgb, var(--paper) 48%, transparent);
  color: var(--dark);
}
.drag-handle:active {
  cursor: grabbing;
}
.drag-handle__icon {
  width: 1rem;
  height: 1rem;
}

.member-cell {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 220px;
}

.avatar {
  display: grid;
  place-items: center;
  width: 2.8rem;
  height: 2.8rem;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--subtle));
  background: color-mix(in srgb, var(--accent) 10%, white);
  color: var(--accent);
  font-size: 0.78rem;
  font-weight: 600;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.member-cell__copy strong {
  display: block;
  color: var(--dark);
  font-weight: 500;
  margin-bottom: 0.16rem;
}
.member-cell__copy span {
  display: block;
  color: var(--muted);
  font-size: 0.62rem;
}

.pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--subtle);
  padding: 0.22rem 0.5rem;
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  white-space: nowrap;
}
.pill--staff {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 36%, var(--subtle));
}
.pill--member {
  color: var(--muted);
}
.pill--active {
  color: #24745b;
  border-color: color-mix(in srgb, #24745b 34%, var(--subtle));
}
.pill--hidden {
  border-style: dashed;
}

.muted {
  color: var(--muted);
}
.muted a {
  color: var(--muted);
  text-decoration: none;
}
.muted a:hover {
  color: var(--accent);
}

.actions-cell {
  width: 1%;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid transparent;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background 0.15s;
}
.icon-btn:hover {
  border-color: var(--subtle);
  background: color-mix(in srgb, var(--paper) 48%, transparent);
  color: var(--dark);
}
.icon-btn--danger {
  color: #b0243c;
}
.icon-btn--danger:hover {
  border-color: color-mix(in srgb, #b0243c 35%, var(--subtle));
  color: #8f1c30;
}
.icon-btn__icon {
  width: 1rem;
  height: 1rem;
}

.empty {
  padding: 2rem 0;
  color: var(--muted);
  font-size: 0.78rem;
}

.member-form {
  display: grid;
  gap: 1rem;
}

.form-layout {
  display: grid;
  grid-template-columns: 15rem minmax(0, 1fr);
  gap: 1.1rem;
  align-items: start;
}

.photo-field {
  display: grid;
  gap: 0.45rem;
}

.photo-field > span,
.form-field span,
.check-field span {
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.85rem;
}

.form-field {
  display: grid;
  gap: 0.45rem;
}

.form-field input,
.form-field select,
.form-field textarea {
  width: 100%;
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.78rem;
  padding: 0.68rem 0.75rem;
  outline: none;
  transition: border-color 0.15s;
}
.form-field input:focus,
.form-field select:focus,
.form-field textarea:focus {
  border-color: var(--accent);
}
.form-field textarea {
  min-height: 6rem;
  line-height: 1.55;
  resize: vertical;
}

.fields-grid__wide {
  grid-column: 1 / -1;
}

.check-field {
  align-self: end;
  display: flex;
  align-items: center;
  gap: 0.48rem;
  min-height: 2.75rem;
  cursor: pointer;
}
.check-field input {
  width: 0.9rem;
  height: 0.9rem;
  margin: 0;
  border: 1px solid var(--subtle);
  appearance: none;
  cursor: pointer;
}
.check-field input:checked {
  background:
    linear-gradient(45deg, transparent 58%, #F5F4F0 58% 72%, transparent 72%),
    linear-gradient(-45deg, transparent 46%, #F5F4F0 46% 60%, transparent 60%),
    var(--accent);
  border-color: var(--accent);
}
.check-field input:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 2px;
}

.form-error {
  border: 1px solid color-mix(in srgb, #b0243c 36%, var(--subtle));
  color: #b0243c;
  padding: 0.7rem 0.8rem;
  font-size: 0.72rem;
  line-height: 1.5;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.35rem;
}
.form-actions--confirm {
  margin-top: 1.25rem;
}

.confirm-text {
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.7;
}
.confirm-text strong {
  color: var(--dark);
  font-weight: 500;
}

@media (max-width: 860px) {
  .members-admin {
    padding: 2rem 1rem 4rem;
  }

  .page-head,
  .section-head,
  .directory-top {
    align-items: flex-start;
    flex-direction: column;
  }

  .page-head h1 {
    font-size: clamp(2.6rem, 16vw, 4rem);
  }

  .overview {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .metric:nth-child(3) {
    border-left: 0;
    border-top: 1px solid var(--subtle);
  }
  .metric:nth-child(4) {
    border-top: 1px solid var(--subtle);
  }

  .intro-grid,
  .form-layout,
  .fields-grid {
    grid-template-columns: 1fr;
  }

  .filters {
    width: 100%;
  }
  .filter-btn {
    flex: 1 1 50%;
    justify-content: space-between;
  }
  .filter-btn:nth-child(odd) {
    border-left: 0;
  }
  .filter-btn:nth-child(n + 3) {
    border-top: 1px solid var(--subtle);
  }

  .table-wrap {
    overflow: visible;
  }

  .members-table,
  .members-table thead,
  .members-table tbody,
  .members-table tr,
  .members-table td {
    display: block;
  }

  .members-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .members-table tr {
    border-bottom: 1px solid var(--subtle);
    padding: 0.95rem 0;
  }
  .members-table tbody tr:hover {
    background: transparent;
  }

  .members-table td {
    display: grid;
    grid-template-columns: 6.5rem 1fr;
    gap: 0.75rem;
    padding: 0.34rem 0;
    border-bottom: 0;
  }
  .members-table td::before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 0.5rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .members-table td:nth-child(2) {
    grid-template-columns: 6.5rem 1fr;
    padding-bottom: 0.85rem;
  }
  .members-table td:nth-child(2)::before,
  .actions-cell::before {
    display: none;
  }

  .drag-cell {
    width: auto;
  }

  .member-cell {
    min-width: 0;
  }

  .actions-cell {
    width: auto;
  }

  .row-actions {
    justify-content: flex-start;
    padding-top: 0.35rem;
  }
}
</style>
