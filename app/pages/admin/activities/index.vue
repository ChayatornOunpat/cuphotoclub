<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'กิจกรรม' })

interface EventRow {
  id: number
  slug: string
  title: string
  summary: string | null
  coverR2Key: string | null
  eventDate: string | null
  location: string | null
  status: 'draft' | 'published'
  createdAt: string
}

const { data: events, pending } = await useFetch<EventRow[]>('/api/admin/events')

const showCreate = ref(false)
const saving = ref(false)
const createErr = ref('')
const title = ref('')

function openCreate() {
  title.value = ''
  createErr.value = ''
  showCreate.value = true
}
async function create() {
  saving.value = true
  createErr.value = ''
  try {
    const ev = await $fetch<{ id: number }>('/api/admin/events', { method: 'POST', body: { title: title.value } })
    await navigateTo(`/admin/activities/${ev.id}`)
  } catch (e) {
    createErr.value = (e as { data?: { message?: string } })?.data?.message || 'สร้างไม่สำเร็จ'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">กิจกรรม</h1>
        <p class="mt-1 text-sm text-ink-soft">ประกาศและข้อมูลกิจกรรมของชมรม</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="size-4" /> สร้างกิจกรรม
      </UiButton>
    </div>

    <div v-if="events && events.length" class="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
      <NuxtLink
        v-for="ev in events"
        :key="ev.id"
        :to="`/admin/activities/${ev.id}`"
        class="flex items-center gap-4 p-4 hover:bg-paper-soft"
      >
        <div class="hidden size-16 shrink-0 overflow-hidden rounded-md bg-paper-soft sm:block">
          <img v-if="ev.coverR2Key" :src="`/images/${ev.coverR2Key}`" class="size-full object-cover" alt="" loading="lazy">
          <div v-else class="flex size-full items-center justify-center text-ink-soft/30"><Icon name="heroicons:calendar-days" class="size-6" /></div>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate font-semibold text-ink">{{ ev.title }}</h3>
          <p class="truncate text-sm text-ink-soft">
            {{ ev.eventDate ? formatDate(ev.eventDate) : 'ไม่ระบุวันที่' }}<span v-if="ev.location"> · {{ ev.location }}</span>
          </p>
        </div>
        <UiBadge :tone="ev.status === 'published' ? 'green' : 'gray'">
          {{ ev.status === 'published' ? 'เผยแพร่' : 'ฉบับร่าง' }}
        </UiBadge>
      </NuxtLink>
    </div>

    <div v-else-if="!pending" class="mt-6 rounded-lg border border-dashed border-line bg-white p-12 text-center">
      <Icon name="heroicons:calendar-days" class="mx-auto size-10 text-ink-soft/40" />
      <p class="mt-3 text-sm text-ink-soft">ยังไม่มีกิจกรรม</p>
    </div>

    <UiModal v-model="showCreate" title="สร้างกิจกรรมใหม่">
      <form class="space-y-4" @submit.prevent="create">
        <p v-if="createErr" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ createErr }}</p>
        <UiField label="ชื่อกิจกรรม" input-id="ev-title">
          <UiInput id="ev-title" v-model="title" required placeholder="เช่น Photo Walk รอบเกาะรัตนโกสินทร์" />
        </UiField>
        <div class="flex justify-end gap-2 pt-2">
          <UiButton type="button" variant="secondary" @click="showCreate = false">ยกเลิก</UiButton>
          <UiButton type="submit" :loading="saving">สร้างและกรอกรายละเอียด</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>
