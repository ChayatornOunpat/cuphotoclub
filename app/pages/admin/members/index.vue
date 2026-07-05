<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'สมาชิก' })

interface Member {
  id: number
  nickname: string
  photoR2Key: string | null
  schoolYear: number | null
  position: string | null
  instagram: string | null
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

const form = reactive({
  nickname: '',
  schoolYear: '',
  position: '',
  instagram: '',
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
  const yearA = a.schoolYear ?? 99
  const yearB = b.schoolYear ?? 99
  if (yearA !== yearB) return yearA - yearB
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
  { value: 'all', label: 'ทั้งหมด', count: memberList.value.length },
  { value: 'staff', label: 'เจ้าหน้าที่', count: staffCount.value },
  { value: 'members', label: 'สมาชิก', count: regularCount.value },
  { value: 'hidden', label: 'ซ่อน', count: hiddenCount.value }
])

function resetForm() {
  Object.assign(form, {
    nickname: '',
    schoolYear: '',
    position: '',
    instagram: '',
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
    photoR2Key: member.photoR2Key,
    sortOrder: String(member.sortOrder ?? 0),
    active: member.active
  })
  formError.value = ''
  showForm.value = true
}

function errMsg(e: unknown) {
  const err = e as { data?: { message?: string, statusMessage?: string } }
  return err?.data?.message || err?.data?.statusMessage || 'บันทึกไม่สำเร็จ'
}

function bodyFromForm() {
  return {
    nickname: form.nickname.trim(),
    schoolYear: form.schoolYear ? Number(form.schoolYear) : null,
    position: form.position.trim() || null,
    instagram: form.instagram.replace(/^@/, '').trim() || null,
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
    introMsg.value = 'บันทึกแล้ว'
    await refreshPage()
  } catch {
    introMsg.value = 'บันทึกไม่สำเร็จ'
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
  return year ? `ปี ${year}` : 'ไม่ระบุ'
}

function roleLabel(member: Member) {
  return member.position || 'สมาชิก'
}
</script>

<template>
  <div class="members-admin">
    <header class="page-head">
      <div>
        <NuxtLink to="/admin" class="back">Dashboard</NuxtLink>
        <h1>สมาชิก</h1>
        <p>จัดการรายชื่อเจ้าหน้าที่ สมาชิก รูปโปรไฟล์ และข้อความนำบนหน้าสาธารณะ</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="btn-icon" />
        เพิ่มสมาชิก
      </UiButton>
    </header>

    <section class="overview" aria-label="Member overview">
      <div class="metric">
        <span>{{ memberList.length }}</span>
        <p>ทั้งหมด</p>
      </div>
      <div class="metric">
        <span>{{ activeCount }}</span>
        <p>แสดงอยู่</p>
      </div>
      <div class="metric">
        <span>{{ staffCount }}</span>
        <p>เจ้าหน้าที่</p>
      </div>
      <div class="metric">
        <span>{{ hiddenCount }}</span>
        <p>ซ่อน</p>
      </div>
    </section>

    <section class="intro-panel" aria-label="Public members page intro">
      <div class="section-head">
        <div>
          <p class="kicker">Public Page</p>
          <h2>คำอธิบายหน้าสมาชิก</h2>
        </div>
        <div class="intro-actions">
          <span v-if="introMsg" class="save-state">{{ introMsg }}</span>
          <UiButton size="sm" :loading="introSaving" @click="saveIntro">บันทึกคำอธิบาย</UiButton>
        </div>
      </div>

      <div class="intro-grid">
        <label class="form-field" for="intro-th">
          <span>ภาษาไทย</span>
          <input id="intro-th" v-model="intro.th" type="text" placeholder="เจ้าหน้าที่และสมาชิกที่ร่วมกันสร้างชมรมถ่ายภาพแห่งนี้">
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
          <h2>รายชื่อสมาชิก</h2>
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

      <div class="table-wrap">
        <table v-if="visibleMembers.length" class="members-table">
          <thead>
            <tr>
              <th>สมาชิก</th>
              <th>ประเภท</th>
              <th>ชั้นปี</th>
              <th>Instagram</th>
              <th>เรียง</th>
              <th>สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="member in visibleMembers" :key="member.id" :class="{ 'is-hidden': !member.active }">
              <td data-label="สมาชิก">
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
              <td data-label="ประเภท">
                <span class="pill" :class="member.position ? 'pill--staff' : 'pill--member'">{{ roleLabel(member) }}</span>
              </td>
              <td data-label="ชั้นปี" class="muted">{{ yearLabel(member.schoolYear) }}</td>
              <td data-label="Instagram" class="muted">
                <a v-if="member.instagram" :href="`https://instagram.com/${member.instagram}`" target="_blank" rel="noopener noreferrer">@{{ member.instagram }}</a>
                <span v-else>—</span>
              </td>
              <td data-label="เรียง" class="muted">{{ member.sortOrder }}</td>
              <td data-label="สถานะ">
                <span class="pill" :class="member.active ? 'pill--active' : 'pill--hidden'">{{ member.active ? 'แสดง' : 'ซ่อน' }}</span>
              </td>
              <td class="actions-cell">
                <div class="row-actions" :aria-label="`Actions for ${member.nickname}`">
                  <button type="button" class="icon-btn" title="แก้ไข" @click="openEdit(member)">
                    <Icon name="heroicons:pencil-square" class="icon-btn__icon" />
                  </button>
                  <button type="button" class="icon-btn" :title="member.active ? 'ซ่อน' : 'แสดง'" @click="toggleActive(member)">
                    <Icon :name="member.active ? 'heroicons:eye-slash' : 'heroicons:eye'" class="icon-btn__icon" />
                  </button>
                  <button type="button" class="icon-btn icon-btn--danger" title="ลบ" @click="confirmTarget = member">
                    <Icon name="heroicons:trash" class="icon-btn__icon" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else-if="pending" class="empty">กำลังโหลดสมาชิก...</p>
        <p v-else class="empty">ยังไม่มีสมาชิกในมุมมองนี้</p>
      </div>
    </section>

    <UiModal v-model="showForm" :title="editing ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'" size="lg">
      <form class="member-form" @submit.prevent="save">
        <p v-if="formError" class="form-error">{{ formError }}</p>

        <div class="form-layout">
          <div class="photo-field">
            <span>รูปโปรไฟล์</span>
            <AdminCoverUploader v-model="form.photoR2Key" prefix="members/photos" aspect="aspect-square" />
          </div>

          <div class="fields-grid">
            <label class="form-field" for="m-nick">
              <span>ชื่อเล่น</span>
              <input id="m-nick" v-model="form.nickname" type="text" required placeholder="เช่น นิว">
            </label>

            <label class="form-field" for="m-year">
              <span>ชั้นปี</span>
              <select id="m-year" v-model="form.schoolYear">
                <option value="">ไม่ระบุ</option>
                <option value="1">ปี 1</option>
                <option value="2">ปี 2</option>
                <option value="3">ปี 3</option>
                <option value="4">ปี 4</option>
              </select>
            </label>

            <label class="form-field" for="m-pos">
              <span>ตำแหน่ง</span>
              <input id="m-pos" v-model="form.position" type="text" placeholder="เว้นว่างสำหรับสมาชิกทั่วไป">
            </label>

            <label class="form-field" for="m-ig">
              <span>Instagram</span>
              <input id="m-ig" v-model="form.instagram" type="text" placeholder="username">
            </label>

            <label class="form-field" for="m-order">
              <span>ลำดับ</span>
              <input id="m-order" v-model="form.sortOrder" type="number" inputmode="numeric">
            </label>

            <label class="check-field">
              <input v-model="form.active" type="checkbox">
              <span>แสดงในหน้าสมาชิก</span>
            </label>
          </div>
        </div>

        <div class="form-actions">
          <UiButton type="button" variant="secondary" @click="showForm = false">ยกเลิก</UiButton>
          <UiButton type="submit" :loading="saving">บันทึก</UiButton>
        </div>
      </form>
    </UiModal>

    <UiModal
      :model-value="!!confirmTarget"
      title="ลบสมาชิก"
      @update:model-value="v => { if (!v) confirmTarget = null }"
    >
      <p class="confirm-text">
        ต้องการลบ <strong>{{ confirmTarget?.nickname }}</strong> ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้
      </p>
      <div class="form-actions form-actions--confirm">
        <UiButton variant="secondary" @click="confirmTarget = null">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="doDelete">ลบ</UiButton>
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
.members-table tbody tr.is-hidden {
  opacity: 0.64;
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
.form-field select {
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
.form-field select:focus {
  border-color: var(--accent);
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

  .members-table td:first-child {
    grid-template-columns: 1fr;
    padding-bottom: 0.85rem;
  }
  .members-table td:first-child::before,
  .actions-cell::before {
    display: none;
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
