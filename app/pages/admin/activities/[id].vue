<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface EventItem {
  id: number
  slug: string
  title: string
  summary: string | null
  body: string
  eventDate: string | null
  location: string | null
  coverR2Key: string | null
  registerUrl: string | null
  status: 'draft' | 'published'
  publishedAt: string | null
}

const route = useRoute()
const id = Number(route.params.id)

const { data: ev, refresh, error } = await useFetch<EventItem>(`/api/admin/events/${id}`)
if (error.value || !ev.value) throw createError({ statusCode: 404, statusMessage: 'ไม่พบกิจกรรม', fatal: true })

useHead(() => ({ title: ev.value?.title || 'กิจกรรม' }))

function errMsg(e: unknown, fb: string) {
  return (e as { data?: { message?: string } })?.data?.message || fb
}

const form = reactive({
  title: '', slug: '', summary: '', body: '', eventDate: '', location: '',
  coverR2Key: null as string | null, registerUrl: '', status: 'draft' as 'draft' | 'published'
})
watchEffect(() => {
  const e = ev.value
  if (e) Object.assign(form, {
    title: e.title, slug: e.slug, summary: e.summary ?? '', body: e.body ?? '',
    eventDate: e.eventDate ? new Date(e.eventDate).toISOString().slice(0, 10) : '',
    location: e.location ?? '', coverR2Key: e.coverR2Key, registerUrl: e.registerUrl ?? '', status: e.status
  })
})

const saving = ref(false)
const savedMsg = ref('')
async function save() {
  saving.value = true
  savedMsg.value = ''
  try {
    await $fetch(`/api/admin/events/${id}`, {
      method: 'PATCH',
      body: {
        title: form.title, slug: form.slug, summary: form.summary || null, body: form.body,
        eventDate: form.eventDate || null, location: form.location || null,
        coverR2Key: form.coverR2Key, registerUrl: form.registerUrl || null, status: form.status
      }
    })
    savedMsg.value = 'บันทึกแล้ว'
    await refresh()
  } catch (e) {
    savedMsg.value = errMsg(e, 'บันทึกไม่สำเร็จ')
  } finally {
    saving.value = false
  }
}

const confirmDelete = ref(false)
const deleting = ref(false)
async function remove() {
  deleting.value = true
  try {
    await $fetch(`/api/admin/events/${id}`, { method: 'DELETE' })
    await navigateTo('/admin/activities')
  } catch (e) {
    alert(errMsg(e, 'ลบไม่สำเร็จ'))
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="ev">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2 text-sm text-ink-soft">
        <NuxtLink to="/admin/activities" class="hover:text-ink"><Icon name="heroicons:arrow-left" class="size-4" /></NuxtLink>
        <span>กิจกรรม</span>
        <Icon name="heroicons:chevron-right" class="size-3" />
        <span class="max-w-[16rem] truncate text-ink">{{ ev.title }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UiButton v-if="ev.status === 'published'" variant="secondary" size="sm" :to="`/activities/${ev.slug}`" target="_blank">
          <Icon name="heroicons:arrow-top-right-on-square" class="size-4" /> ดูบนเว็บไซต์
        </UiButton>
        <UiButton variant="danger" size="sm" @click="confirmDelete = true">
          <Icon name="heroicons:trash" class="size-4" /> ลบ
        </UiButton>
        <UiButton size="sm" :loading="saving" @click="save">บันทึก</UiButton>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem]">
      <section class="space-y-4 rounded-lg border border-line bg-white p-5">
        <UiField label="ชื่อกิจกรรม" input-id="e-title">
          <UiInput id="e-title" v-model="form.title" />
        </UiField>
        <UiField label="Slug (URL)" input-id="e-slug" :hint="`/activities/${form.slug}`">
          <UiInput id="e-slug" v-model="form.slug" />
        </UiField>
        <div class="grid gap-4 sm:grid-cols-2">
          <UiField label="วันที่จัดกิจกรรม" input-id="e-date">
            <UiDateInput id="e-date" v-model="form.eventDate" />
          </UiField>
          <UiField label="สถานที่" input-id="e-loc">
            <UiInput id="e-loc" v-model="form.location" placeholder="เช่น หอศิลป์ กทม." />
          </UiField>
        </div>
        <UiField label="สรุปย่อ" input-id="e-summary" hint="แสดงในหน้ารายการ">
          <UiTextarea id="e-summary" v-model="form.summary" :rows="2" />
        </UiField>
        <UiField label="รายละเอียด (Markdown)" input-id="e-body">
          <UiTextarea id="e-body" v-model="form.body" :rows="14" class="font-mono" />
        </UiField>
      </section>

      <aside class="space-y-5">
        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">เผยแพร่</h3>
          <div class="mt-3 space-y-3">
            <UiField label="สถานะ" input-id="e-status">
              <UiSelect id="e-status" v-model="form.status">
                <option value="draft">ฉบับร่าง</option>
                <option value="published">เผยแพร่</option>
              </UiSelect>
            </UiField>
            <UiButton block :loading="saving" @click="save">บันทึก</UiButton>
            <p v-if="savedMsg" class="text-center text-sm text-ink-soft">{{ savedMsg }}</p>
          </div>
        </div>

        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">รูปปก</h3>
          <div class="mt-3">
            <AdminCoverUploader v-model="form.coverR2Key" prefix="events/covers" />
          </div>
        </div>

        <div class="rounded-lg border border-line bg-white p-5">
          <h3 class="text-sm font-semibold text-ink">ลิงก์ลงทะเบียน</h3>
          <p class="mt-1 text-xs text-ink-soft">เช่น Google Form (ไม่บังคับ)</p>
          <div class="mt-3">
            <UiInput v-model="form.registerUrl" type="url" placeholder="https://…" />
          </div>
        </div>
      </aside>
    </div>

    <UiModal v-model="confirmDelete" title="ลบกิจกรรม">
      <p class="text-sm text-ink-soft">ต้องการลบกิจกรรม <span class="font-medium text-ink">{{ ev.title }}</span> ใช่หรือไม่?</p>
      <div class="mt-5 flex justify-end gap-2">
        <UiButton variant="secondary" @click="confirmDelete = false">ยกเลิก</UiButton>
        <UiButton variant="danger" :loading="deleting" @click="remove">ลบ</UiButton>
      </div>
    </UiModal>
  </div>
</template>
