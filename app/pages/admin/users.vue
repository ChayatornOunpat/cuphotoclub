<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: ['admin', 'admin-manage'] })
useHead({ title: 'ผู้ดูแลระบบ' })

interface AdminUser {
  id: number
  email: string
  name: string | null
  avatarUrl: string | null
  role: 'owner' | 'admin' | 'editor'
  active: boolean
  hasPassword: boolean
  googleLinked: boolean
  createdAt: string
  lastLoginAt: string | null
}

const { user: me } = useUserSession()
const canEditOwners = computed(() => me.value?.role === 'owner')
const roleLabels = { owner: 'เจ้าของ', admin: 'ผู้ดูแล', editor: 'ผู้แก้ไข' } as const

const { data: users, refresh, pending } = await useFetch<AdminUser[]>('/api/admin/users')

const showForm = ref(false)
const editing = ref<AdminUser | null>(null)
const saving = ref(false)
const formError = ref('')
const form = reactive({ email: '', name: '', role: 'editor', password: '' })

function errMsg(e: unknown, fallback: string) {
  const err = e as { data?: { message?: string, statusMessage?: string } }
  return err?.data?.message || err?.data?.statusMessage || fallback
}

function openCreate() {
  editing.value = null
  Object.assign(form, { email: '', name: '', role: 'editor', password: '' })
  formError.value = ''
  showForm.value = true
}

function openEdit(u: AdminUser) {
  editing.value = u
  Object.assign(form, { email: u.email, name: u.name ?? '', role: u.role, password: '' })
  formError.value = ''
  showForm.value = true
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    if (editing.value) {
      const body: Record<string, unknown> = { name: form.name || null, role: form.role }
      if (form.password) body.password = form.password
      await $fetch(`/api/admin/users/${editing.value.id}`, { method: 'PATCH', body })
    } else {
      await $fetch('/api/admin/users', {
        method: 'POST',
        body: {
          email: form.email,
          name: form.name || undefined,
          role: form.role,
          password: form.password || undefined
        }
      })
    }
    showForm.value = false
    await refresh()
  } catch (e) {
    formError.value = errMsg(e, 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}

async function toggleActive(u: AdminUser) {
  try {
    await $fetch(`/api/admin/users/${u.id}`, { method: 'PATCH', body: { active: !u.active } })
    await refresh()
  } catch (e) {
    alert(errMsg(e, 'ทำรายการไม่สำเร็จ'))
  }
}

const confirmTarget = ref<AdminUser | null>(null)
const deleting = ref(false)
async function doDelete() {
  if (!confirmTarget.value) return
  deleting.value = true
  try {
    await $fetch(`/api/admin/users/${confirmTarget.value.id}`, { method: 'DELETE' })
    confirmTarget.value = null
    await refresh()
  } catch (e) {
    alert(errMsg(e, 'ลบไม่สำเร็จ'))
  } finally {
    deleting.value = false
  }
}

function initialFor(u: AdminUser) {
  return (u.name || u.email).trim().slice(0, 1).toUpperCase()
}

function loginMethods(u: AdminUser) {
  const methods: string[] = []
  if (u.hasPassword) methods.push('Password')
  if (u.googleLinked) methods.push('Google')
  return methods.length ? methods.join(' + ') : 'No login method'
}

function roleTone(role: AdminUser['role']) {
  return role === 'owner' ? 'pill--owner' : role === 'admin' ? 'pill--admin' : 'pill--editor'
}
</script>

<template>
  <div class="admin-wrap">
    <header class="page-head">
      <div class="page-head__copy">
        <NuxtLink to="/admin" class="back">Dashboard</NuxtLink>
        <h1>ผู้ดูแลระบบ</h1>
        <p>จัดการบัญชี สิทธิ์การเข้าถึง และวิธีเข้าสู่ระบบของทีมผู้ดูแล</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="btn-icon" />
        เพิ่มผู้ดูแล
      </UiButton>
    </header>

    <section class="iam-panel" aria-label="Admin users">
      <div class="iam-panel__summary">
        <span>{{ users?.length ?? 0 }} accounts</span>
        <span>{{ users?.filter(u => u.active).length ?? 0 }} active</span>
      </div>

      <div class="table-scroll">
        <table v-if="users?.length" class="iam-table">
          <thead>
            <tr>
              <th>ผู้ใช้</th>
              <th>บทบาท</th>
              <th>สถานะ</th>
              <th>เข้าสู่ระบบ</th>
              <th>ล่าสุด</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in users" :key="u.id">
              <td data-label="ผู้ใช้">
                <div class="user-cell">
                  <span class="avatar">
                    <img v-if="u.avatarUrl" :src="u.avatarUrl" alt="">
                    <template v-else>{{ initialFor(u) }}</template>
                  </span>
                  <div class="user-cell__copy">
                    <strong>{{ u.name || 'Unnamed admin' }}</strong>
                    <span>{{ u.email }}</span>
                  </div>
                </div>
              </td>
              <td data-label="บทบาท">
                <span class="pill" :class="roleTone(u.role)">
                  {{ roleLabels[u.role] }}
                </span>
              </td>
              <td data-label="สถานะ">
                <span class="pill" :class="u.active ? 'pill--active' : 'pill--inactive'">
                  {{ u.active ? 'ใช้งาน' : 'ปิดใช้งาน' }}
                </span>
              </td>
              <td data-label="เข้าสู่ระบบ">
                <div class="auth-methods" :title="loginMethods(u)">
                  <span v-if="u.hasPassword" class="auth-method">
                    <Icon name="heroicons:key" class="auth-method__icon" />
                    <span>Password</span>
                  </span>
                  <span v-if="u.googleLinked" class="auth-method">
                    <Icon name="heroicons:globe-alt" class="auth-method__icon" />
                    <span>Google</span>
                  </span>
                  <span v-if="!u.hasPassword && !u.googleLinked" class="muted">—</span>
                </div>
              </td>
              <td data-label="ล่าสุด" class="muted">{{ formatDate(u.lastLoginAt) || '—' }}</td>
              <td class="actions-cell">
                <div class="row-actions" :aria-label="`Actions for ${u.email}`">
                  <button type="button" class="icon-btn" title="แก้ไข" @click="openEdit(u)">
                    <Icon name="heroicons:pencil-square" class="icon-btn__icon" />
                  </button>
                  <button v-if="u.id !== me?.id" type="button" class="icon-btn" :title="u.active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'" @click="toggleActive(u)">
                    <Icon :name="u.active ? 'heroicons:no-symbol' : 'heroicons:check-circle'" class="icon-btn__icon" />
                  </button>
                  <button v-if="u.id !== me?.id" type="button" class="icon-btn icon-btn--danger" title="ลบ" @click="confirmTarget = u">
                    <Icon name="heroicons:trash" class="icon-btn__icon" />
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <p v-else-if="pending" class="empty">กำลังโหลดบัญชีผู้ดูแล...</p>
        <p v-else class="empty">ยังไม่มีผู้ดูแล</p>
      </div>
    </section>

    <UiModal v-model="showForm" :title="editing ? 'แก้ไขผู้ดูแล' : 'เพิ่มผู้ดูแล'">
      <form class="iam-form" @submit.prevent="save">
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <label class="form-field" for="f-email">
          <span>อีเมล</span>
          <input id="f-email" v-model="form.email" type="email" :disabled="!!editing" required placeholder="you@cuphotoclub.com">
        </label>
        <label class="form-field" for="f-name">
          <span>ชื่อ</span>
          <input id="f-name" v-model="form.name" type="text" placeholder="ชื่อที่แสดง">
        </label>
        <label class="form-field" for="f-role">
          <span>บทบาท</span>
          <select id="f-role" v-model="form.role">
            <option v-if="canEditOwners" value="owner">เจ้าของ</option>
            <option value="admin">ผู้ดูแล</option>
            <option value="editor">ผู้แก้ไข</option>
          </select>
        </label>
        <label class="form-field" for="f-pw">
          <span>รหัสผ่าน</span>
          <input id="f-pw" v-model="form.password" type="password" autocomplete="new-password">
          <small>{{ editing ? 'เว้นว่างหากไม่ต้องการเปลี่ยน' : 'อย่างน้อย 8 ตัวอักษร เว้นว่างได้หากใช้ Google login' }}</small>
        </label>
        <div class="form-actions">
          <UiButton type="button" variant="secondary" @click="showForm = false">ยกเลิก</UiButton>
          <UiButton type="submit" :loading="saving">บันทึก</UiButton>
        </div>
      </form>
    </UiModal>

    <UiModal
      :model-value="!!confirmTarget"
      title="ลบผู้ดูแล"
      @update:model-value="v => { if (!v) confirmTarget = null }"
    >
      <p class="confirm-text">
        ต้องการลบบัญชี <strong>{{ confirmTarget?.email }}</strong> ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้
      </p>
      <div class="form-actions form-actions--confirm">
        <UiButton variant="secondary" @click="confirmTarget = null">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="doDelete">ลบ</UiButton>
      </div>
    </UiModal>
  </div>
</template>

<style scoped>
.admin-wrap {
  max-width: 1120px;
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

.page-head__copy {
  max-width: 680px;
}

.back {
  display: inline-block;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  text-decoration: none;
  margin-bottom: 0.65rem;
}
.back:hover { color: var(--accent); }

.page-head h1 {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 6.6vw, 6rem);
  line-height: 0.95;
  font-weight: 200;
  color: var(--dark);
}

.page-head p {
  margin-top: 0.75rem;
  color: var(--muted);
  font-size: 0.78rem;
  line-height: 1.7;
}

.btn-icon {
  width: 0.82rem;
  height: 0.82rem;
  flex-shrink: 0;
}

.iam-panel {
  border-top: 2px solid var(--accent);
}

.iam-panel__summary {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--subtle);
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.table-scroll {
  overflow-x: auto;
  scrollbar-width: thin;
}

.iam-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-sans);
}

.iam-table th {
  text-align: left;
  padding: 0.75rem 0.9rem;
  border-bottom: 1px solid var(--subtle);
  color: var(--muted);
  font-size: 0.5rem;
  font-weight: 500;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  white-space: nowrap;
}

.iam-table td {
  padding: 0.95rem 0.9rem;
  border-bottom: 1px solid var(--subtle);
  color: var(--dark);
  font-size: 0.78rem;
  vertical-align: middle;
}

.iam-table tbody tr {
  transition: background 0.15s;
}
.iam-table tbody tr:hover {
  background: color-mix(in srgb, var(--paper) 38%, transparent);
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  min-width: 260px;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.4rem;
  height: 2.4rem;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--accent) 30%, var(--subtle));
  background: color-mix(in srgb, var(--accent) 10%, white);
  color: var(--accent);
  font-size: 0.76rem;
  font-weight: 600;
}
.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-cell__copy strong {
  display: block;
  font-weight: 500;
  color: var(--dark);
  margin-bottom: 0.18rem;
}
.user-cell__copy span {
  display: block;
  color: var(--muted);
  font-size: 0.68rem;
  word-break: break-word;
}

.pill {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--subtle);
  padding: 0.22rem 0.5rem;
  font-size: 0.54rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
  white-space: nowrap;
}
.pill--owner { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 34%, var(--subtle)); }
.pill--admin { color: #87611e; border-color: color-mix(in srgb, #87611e 30%, var(--subtle)); }
.pill--editor { color: var(--muted); }
.pill--active { color: #24745b; border-color: color-mix(in srgb, #24745b 30%, var(--subtle)); }
.pill--inactive { color: var(--muted); border-style: dashed; }

.auth-methods {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
  min-width: 140px;
}

.auth-method {
  display: inline-flex;
  align-items: center;
  gap: 0.28rem;
  color: var(--muted);
  font-size: 0.6rem;
}
.auth-method__icon {
  width: 0.86rem;
  height: 0.86rem;
}

.muted {
  color: var(--muted);
}

.actions-cell {
  width: 1%;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.25rem;
  white-space: nowrap;
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
  color: var(--dark);
  background: color-mix(in srgb, var(--paper) 48%, transparent);
}
.icon-btn--danger { color: #b0243c; }
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

.iam-form {
  display: grid;
  gap: 1rem;
}

.form-error {
  border: 1px solid color-mix(in srgb, #b0243c 36%, var(--subtle));
  color: #b0243c;
  padding: 0.7rem 0.8rem;
  font-size: 0.72rem;
  line-height: 1.5;
}

.form-field {
  display: grid;
  gap: 0.45rem;
}

.form-field span {
  color: var(--muted);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.form-field input,
.form-field select {
  width: 100%;
  border: 1px solid var(--subtle);
  background: #fff;
  color: var(--dark);
  font-family: var(--font-sans);
  font-size: 0.82rem;
  padding: 0.72rem 0.8rem;
  outline: none;
  transition: border-color 0.15s;
}
.form-field input:focus,
.form-field select:focus {
  border-color: var(--accent);
}
.form-field input:disabled {
  color: var(--muted);
  background: color-mix(in srgb, var(--paper) 60%, white);
}
.form-field small {
  color: var(--muted);
  font-size: 0.62rem;
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

@media (max-width: 760px) {
  .admin-wrap {
    padding: 2rem 1rem 4rem;
  }

  .page-head {
    align-items: flex-start;
    flex-direction: column;
    margin-bottom: 1.6rem;
  }

  .page-head h1 {
    font-size: clamp(2.6rem, 16vw, 4rem);
  }

  .iam-panel__summary {
    justify-content: flex-start;
  }

  .table-scroll {
    overflow: visible;
  }

  .iam-table,
  .iam-table thead,
  .iam-table tbody,
  .iam-table tr,
  .iam-table td {
    display: block;
  }

  .iam-table thead {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
  }

  .iam-table tr {
    border-bottom: 1px solid var(--subtle);
    padding: 0.9rem 0;
  }
  .iam-table tbody tr:hover {
    background: transparent;
  }

  .iam-table td {
    display: grid;
    grid-template-columns: 7rem 1fr;
    gap: 0.75rem;
    padding: 0.36rem 0;
    border-bottom: none;
  }
  .iam-table td::before {
    content: attr(data-label);
    color: var(--muted);
    font-size: 0.5rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .iam-table td:first-child {
    grid-template-columns: 1fr;
    padding-bottom: 0.8rem;
  }
  .iam-table td:first-child::before {
    display: none;
  }

  .user-cell {
    min-width: 0;
  }

  .actions-cell {
    width: auto;
  }

  .actions-cell::before {
    display: none;
  }

  .row-actions {
    justify-content: flex-start;
    padding-top: 0.3rem;
  }

  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
