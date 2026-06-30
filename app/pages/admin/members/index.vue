<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'สมาชิก' })

// ── Page intro (lead text for EN + TH) ───────────────────────────────────────
const { data: pageData, refresh: refreshPage } = await useFetch<{ title: string, bodyHtml: string, body?: string }>('/api/admin/pages/members')
const intro = reactive({ en: '', th: '' })
const introSaving = ref(false)
const introMsg = ref('')

watchEffect(() => {
  if (!pageData.value) return
  try {
    const parsed = JSON.parse((pageData.value as any).body || '{}')
    intro.en = parsed.en || ''
    intro.th = parsed.th || ''
  } catch {}
})

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

const { data: members, refresh, pending } = await useFetch<Member[]>('/api/admin/members')

const showForm = ref(false)
const editing = ref<Member | null>(null)
const saving = ref(false)
const formError = ref('')
const confirmTarget = ref<Member | null>(null)
const deleting = ref(false)

const form = reactive<{
  nickname: string
  schoolYear: string
  position: string
  instagram: string
  photoR2Key: string | null
  active: boolean
}>({
  nickname: '',
  schoolYear: '',
  position: '',
  instagram: '',
  photoR2Key: null,
  active: true
})

function openCreate() {
  editing.value = null
  Object.assign(form, { nickname: '', schoolYear: '', position: '', instagram: '', photoR2Key: null, active: true })
  formError.value = ''
  showForm.value = true
}

function openEdit(m: Member) {
  editing.value = m
  Object.assign(form, {
    nickname: m.nickname,
    schoolYear: m.schoolYear ? String(m.schoolYear) : '',
    position: m.position ?? '',
    instagram: m.instagram ?? '',
    photoR2Key: m.photoR2Key,
    active: m.active
  })
  formError.value = ''
  showForm.value = true
}

function errMsg(e: unknown) {
  return (e as { data?: { message?: string } })?.data?.message || 'บันทึกไม่สำเร็จ'
}

async function save() {
  saving.value = true
  formError.value = ''
  try {
    const body = {
      nickname:   form.nickname,
      schoolYear: form.schoolYear ? Number(form.schoolYear) : null,
      position:   form.position || null,
      instagram:  form.instagram.replace(/^@/, '').trim() || null,
      photoR2Key: form.photoR2Key,
      active:     form.active
    }
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

async function toggleActive(m: Member) {
  try {
    await $fetch(`/api/admin/members/${m.id}`, { method: 'PATCH', body: { active: !m.active } })
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

const yearLabel = (y: number | null) => y ? `ปี ${y}` : '—'
const staffFirst = computed(() => {
  if (!members.value) return []
  return [...members.value].sort((a, b) => {
    if (!!a.position === !!b.position) return 0
    return a.position ? -1 : 1
  })
})
</script>

<template>
  <div class="space-y-10">

    <!-- Page intro editor -->
    <div>
      <h2 class="text-base font-semibold text-ink">คำอธิบายหน้าสมาชิก</h2>
      <p class="mt-0.5 text-sm text-ink-soft">ข้อความที่แสดงใต้หัวข้อในหน้าสมาชิกสาธารณะ</p>
      <div class="mt-4 rounded-lg border border-line bg-white p-5 space-y-4">
        <UiField label="ภาษาไทย" input-id="intro-th">
          <UiInput id="intro-th" v-model="intro.th" placeholder="เจ้าหน้าที่และสมาชิกที่ร่วมกันสร้างชมรมถ่ายภาพแห่งนี้" />
        </UiField>
        <UiField label="English" input-id="intro-en">
          <UiInput id="intro-en" v-model="intro.en" placeholder="The staff and members who make up CU Photo." />
        </UiField>
        <div class="flex items-center gap-3">
          <UiButton :loading="introSaving" @click="saveIntro">บันทึก</UiButton>
          <span v-if="introMsg" class="text-sm text-ink-soft">{{ introMsg }}</span>
        </div>
      </div>
    </div>

    <!-- Members list -->
    <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">สมาชิก</h1>
        <p class="mt-1 text-sm text-ink-soft">รายชื่อสมาชิกและเจ้าหน้าที่ชมรม</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="size-4" /> เพิ่มสมาชิก
      </UiButton>
    </div>

    <div class="mt-6 overflow-hidden rounded-lg border border-line bg-white">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-line text-sm">
          <thead class="bg-paper-soft text-left text-xs uppercase tracking-wide text-ink-soft">
            <tr>
              <th class="px-4 py-3 font-medium">สมาชิก</th>
              <th class="px-4 py-3 font-medium">ชั้นปี</th>
              <th class="px-4 py-3 font-medium">ตำแหน่ง</th>
              <th class="px-4 py-3 font-medium">Instagram</th>
              <th class="px-4 py-3 font-medium">สถานะ</th>
              <th class="px-4 py-3" />
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="m in staffFirst" :key="m.id" class="hover:bg-paper-soft/50">
              <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                  <span class="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft text-xs font-semibold text-pink-700">
                    <img v-if="m.photoR2Key" :src="`/images/${m.photoR2Key}`" class="size-9 object-cover" alt="">
                    <template v-else>{{ m.nickname.slice(0, 1).toUpperCase() }}</template>
                  </span>
                  <span class="font-medium text-ink">{{ m.nickname }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-ink-soft">{{ yearLabel(m.schoolYear) }}</td>
              <td class="px-4 py-3">
                <span v-if="m.position" class="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-pink-700">{{ m.position }}</span>
                <span v-else class="text-ink-soft">—</span>
              </td>
              <td class="px-4 py-3 text-ink-soft">
                <span v-if="m.instagram" class="text-xs">@{{ m.instagram }}</span>
                <span v-else>—</span>
              </td>
              <td class="px-4 py-3">
                <UiBadge :tone="m.active ? 'green' : 'gray'">{{ m.active ? 'ใช้งาน' : 'ซ่อน' }}</UiBadge>
              </td>
              <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-1">
                  <button type="button" class="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink" @click="openEdit(m)">
                    <Icon name="heroicons:pencil-square" class="size-4" />
                  </button>
                  <button type="button" class="rounded-md p-1.5 text-ink-soft hover:bg-paper-soft hover:text-ink" @click="toggleActive(m)">
                    <Icon :name="m.active ? 'heroicons:eye-slash' : 'heroicons:eye'" class="size-4" />
                  </button>
                  <button type="button" class="rounded-md p-1.5 text-red-500 hover:bg-red-50" @click="confirmTarget = m">
                    <Icon name="heroicons:trash" class="size-4" />
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!pending && (!members || members.length === 0)">
              <td colspan="6" class="px-4 py-10 text-center text-ink-soft">ยังไม่มีสมาชิก</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <UiModal v-model="showForm" :title="editing ? 'แก้ไขสมาชิก' : 'เพิ่มสมาชิก'">
      <form class="space-y-4" @submit.prevent="save">
        <p v-if="formError" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ formError }}</p>

        <UiField label="ชื่อเล่น" input-id="m-nick">
          <UiInput id="m-nick" v-model="form.nickname" required placeholder="เช่น นิว" />
        </UiField>

        <UiField label="ชั้นปี" input-id="m-year">
          <UiSelect id="m-year" v-model="form.schoolYear">
            <option value="">ไม่ระบุ</option>
            <option value="1">ปี 1</option>
            <option value="2">ปี 2</option>
            <option value="3">ปี 3</option>
            <option value="4">ปี 4</option>
          </UiSelect>
        </UiField>

        <UiField label="ตำแหน่ง (เฉพาะเจ้าหน้าที่)" input-id="m-pos" hint="เว้นว่างสำหรับสมาชิกทั่วไป">
          <UiInput id="m-pos" v-model="form.position" placeholder="เช่น ประธาน, ฝ่ายภาพ" />
        </UiField>

        <UiField label="Instagram" input-id="m-ig" hint="ใส่ชื่อผู้ใช้ ไม่ต้องมี @">
          <UiInput id="m-ig" v-model="form.instagram" placeholder="username" />
        </UiField>

        <UiField label="รูปภาพ (เจ้าหน้าที่)" input-id="m-photo">
          <AdminCoverUploader v-model="form.photoR2Key" prefix="members/photos" aspect="aspect-square" />
        </UiField>

        <label class="flex items-center gap-2 text-sm text-ink">
          <input v-model="form.active" type="checkbox" class="rounded border-line">
          แสดงในหน้าสมาชิก
        </label>

        <div class="flex justify-end gap-2 pt-2">
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
      <p class="text-sm text-ink-soft">
        ต้องการลบ <span class="font-medium text-ink">{{ confirmTarget?.nickname }}</span> ใช่หรือไม่? การกระทำนี้ย้อนกลับไม่ได้
      </p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="confirmTarget = null">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="doDelete">ลบ</UiButton>
      </div>
    </UiModal>
    </div> <!-- /members list -->
  </div>
</template>
