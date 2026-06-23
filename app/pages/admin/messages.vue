<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'ข้อความติดต่อ' })

interface Message {
  id: number
  name: string
  email: string
  subject: string | null
  message: string
  createdAt: string
  readAt: string | null
  archived: boolean
}

const { data: messages, refresh } = await useFetch<Message[]>('/api/admin/messages')

const showArchived = ref(false)
const visible = computed(() => (messages.value ?? []).filter(m => (showArchived.value ? m.archived : !m.archived)))

const selected = ref<Message | null>(null)
async function open(m: Message) {
  selected.value = m
  if (!m.readAt) {
    await $fetch(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { read: true } }).catch(() => {})
    await refresh()
    selected.value = (messages.value ?? []).find(x => x.id === m.id) ?? selected.value
  }
}
async function setArchived(m: Message, archived: boolean) {
  await $fetch(`/api/admin/messages/${m.id}`, { method: 'PATCH', body: { archived } }).catch(() => {})
  selected.value = null
  await refresh()
}
async function remove(m: Message) {
  await $fetch(`/api/admin/messages/${m.id}`, { method: 'DELETE' }).catch(() => {})
  selected.value = null
  await refresh()
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between gap-4">
      <div>
        <h1 class="text-xl font-semibold text-ink">ข้อความติดต่อ</h1>
        <p class="mt-1 text-sm text-ink-soft">ข้อความที่ส่งผ่านหน้าติดต่อเรา</p>
      </div>
      <div class="flex rounded-md bg-paper-soft p-0.5 text-sm ring-1 ring-inset ring-line">
        <button type="button" class="rounded px-3 py-1 font-medium" :class="!showArchived ? 'bg-white text-ink shadow-xs' : 'text-ink-soft'" @click="showArchived = false">กล่องข้อความ</button>
        <button type="button" class="rounded px-3 py-1 font-medium" :class="showArchived ? 'bg-white text-ink shadow-xs' : 'text-ink-soft'" @click="showArchived = true">เก็บถาวร</button>
      </div>
    </div>

    <div v-if="visible.length" class="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
      <button
        v-for="m in visible"
        :key="m.id"
        type="button"
        class="flex w-full items-center gap-4 p-4 text-left hover:bg-paper-soft"
        @click="open(m)"
      >
        <span class="size-2 shrink-0 rounded-full" :class="m.readAt ? 'bg-transparent' : 'bg-accent'" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span :class="m.readAt ? 'font-medium text-ink' : 'font-semibold text-ink'">{{ m.name }}</span>
            <span class="truncate text-xs text-ink-soft">{{ m.email }}</span>
          </div>
          <p class="truncate text-sm text-ink-soft">{{ m.subject || m.message }}</p>
        </div>
        <span class="hidden shrink-0 text-xs text-ink-soft sm:block">{{ formatDateTime(m.createdAt) }}</span>
      </button>
    </div>

    <div v-else class="mt-6 rounded-lg border border-dashed border-line bg-white p-12 text-center">
      <Icon name="heroicons:inbox" class="mx-auto size-10 text-ink-soft/40" />
      <p class="mt-3 text-sm text-ink-soft">{{ showArchived ? 'ไม่มีข้อความที่เก็บถาวร' : 'ยังไม่มีข้อความ' }}</p>
    </div>

    <UiModal :model-value="!!selected" :title="selected?.subject || 'ข้อความ'" @update:model-value="v => { if (!v) selected = null }">
      <template v-if="selected">
        <div class="text-sm">
          <p class="font-medium text-ink">{{ selected.name }}</p>
          <a :href="`mailto:${selected.email}`" class="text-accent hover:underline">{{ selected.email }}</a>
          <p class="mt-1 text-xs text-ink-soft">{{ formatDateTime(selected.createdAt) }}</p>
        </div>
        <p class="mt-4 whitespace-pre-wrap text-sm text-ink">{{ selected.message }}</p>
        <div class="mt-6 flex flex-wrap justify-end gap-2">
          <UiButton variant="secondary" size="sm" :to="`mailto:${selected.email}`">
            <Icon name="heroicons:arrow-uturn-left" class="size-4" /> ตอบกลับ
          </UiButton>
          <UiButton variant="secondary" size="sm" @click="setArchived(selected, !selected.archived)">
            <Icon name="heroicons:archive-box" class="size-4" /> {{ selected.archived ? 'นำออกจากที่เก็บ' : 'เก็บถาวร' }}
          </UiButton>
          <UiButton variant="danger" size="sm" @click="remove(selected)">
            <Icon name="heroicons:trash" class="size-4" /> ลบ
          </UiButton>
        </div>
      </template>
    </UiModal>
  </div>
</template>
