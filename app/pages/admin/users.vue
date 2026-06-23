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
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">ผู้ดูแลระบบ</h1>
        <p class="mt-1 text-sm text-ink-soft">จัดการบัญชีและสิทธิ์การเข้าถึง (รายชื่อนี้คือผู้ที่ลงชื่อเข้าใช้ได้)</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="size-4" /> เพิ่มผู้ดูแล
      </UiButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-line bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-line text-sm">
          <thead class="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th class="px-4 py-3 font-medium">ผู้ใช้</th>
              <th class="px-4 py-3 font-medium">บทบาท</th>
              <th class="px-4 py-3 font-medium">สถานะ</th>
              <th class="px-4 py-3 font-medium">เข้าสู่ระบบ</th>
              <th class="px-4 py-3 font-medium">ล่าสุด</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="u in users" :key="u.id" class="hover:bg-paper-soft/50">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-xs font-semibold text-pink-700">
                    <img v-if="u.avatarUrl" :src="u.avatarUrl" class="size-8 object-cover" alt="">
                    <template v-else>{{ (u.name || u.email).slice(0, 1).toUpperCase() }}</template>
                  </span>
                  <div>
                    <p class="font-medium text-ink">{{ u.name || '—' }}</p>
                    <p class="text-xs text-ink-soft">{{ u.email }}</p>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <UiBadge :tone="u.role === 'owner' ? 'pink' : u.role === 'admin' ? 'amber' : 'gray'">
                  {{ roleLabels[u.role] }}
                </UiBadge>
              </td>
              <td class="px-4 py-3">
                <UiBadge :tone="u.active ? 'green' : 'gray'">{{ u.active ? 'ใช้งาน' : 'ปิดใช้งาน' }}</UiBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center gap-2 text-ink-soft">
                  <Icon v-if="u.hasPassword" name="heroicons:key" class="size-4" />
                  <Icon v-if="u.googleLinked" name="heroicons:globe-alt" class="size-4" />
                  <span v-if="!u.hasPassword && !u.googleLinked" class="text-xs">—</span>
                </div>
              </td>
              <td class="px-4 py-3 text-ink-soft">{{ formatDate(u.lastLoginAt) }}</td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button type="button" class="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink" @click="openEdit(u)">
                    <Icon name="heroicons:pencil-square" class="size-4" />
                  </button>
                  <button v-if="u.id !== me?.id" type="button" class="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink" @click="toggleActive(u)">
                    <Icon :name="u.active ? 'heroicons:no-symbol' : 'heroicons:check-circle'" class="size-4" />
                  </button>
                  <button v-if="u.id !== me?.id" type="button" class="rounded-md p-1.5 text-red-500 hover:bg-red-50" @click="confirmTarget = u">
                    <Icon name="heroicons:trash" class="size-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!pending && (!users || users.length === 0)">
              <td colspan="6" class="px-4 py-10 text-center text-ink-soft">ยังไม่มีผู้ดูแล</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UiModal v-model="showForm" :title="editing ? 'แก้ไขผู้ดูแล' : 'เพิ่มผู้ดูแล'">
      <form class="space-y-4" @submit.prevent="save">
        <p v-if="formError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError }}</p>
        <UiField label="อีเมล" input-id="f-email">
          <UiInput id="f-email" v-model="form.email" type="email" :disabled="!!editing" required placeholder="you@cuphotoclub.com" />
        </UiField>
        <UiField label="ชื่อ" input-id="f-name">
          <UiInput id="f-name" v-model="form.name" placeholder="ชื่อที่แสดง" />
        </UiField>
        <UiField label="บทบาท" input-id="f-role">
          <UiSelect id="f-role" v-model="form.role">
            <option v-if="canEditOwners" value="owner">เจ้าของ</option>
            <option value="admin">ผู้ดูแล</option>
            <option value="editor">ผู้แก้ไข</option>
          </UiSelect>
        </UiField>
        <UiField
          label="รหัสผ่าน"
          input-id="f-pw"
          :hint="editing ? 'เว้นว่างหากไม่ต้องการเปลี่ยน' : 'อย่างน้อย 8 ตัวอักษร — เว้นว่างได้หากใช้ Google login'"
        >
          <UiInput id="f-pw" v-model="form.password" type="password" autocomplete="new-password" />
        </UiField>
        <div class="flex justify-end gap-2 pt-2">
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
      <p class="text-sm text-ink-soft">
        ต้องการลบบัญชี <span class="font-medium text-ink">{{ confirmTarget?.email }}</span> ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="confirmTarget = null">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="doDelete">ลบ</UiButton>
      </div>
    </UiModal>
  </div>
</template>
