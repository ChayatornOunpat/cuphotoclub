<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'บทความ' })

interface PostRow {
  id: number
  slug: string
  title: string
  excerpt: string | null
  coverR2Key: string | null
  status: 'draft' | 'published'
  publishedAt: string | null
  createdAt: string
}

const { data: posts, pending } = await useFetch<PostRow[]>('/api/admin/posts')

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
    const post = await $fetch<{ id: number }>('/api/admin/posts', { method: 'POST', body: { title: title.value } })
    await navigateTo(`/admin/blog/${post.id}`)
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
        <h1 class="text-xl font-semibold text-ink">บทความ</h1>
        <p class="mt-1 text-sm text-ink-soft">เขียนข่าวสารและบทความของชมรม</p>
      </div>
      <UiButton @click="openCreate">
        <Icon name="heroicons:plus" class="size-4" /> เขียนบทความ
      </UiButton>
    </div>

    <div v-if="posts && posts.length" class="mt-6 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
      <NuxtLink
        v-for="post in posts"
        :key="post.id"
        :to="`/admin/blog/${post.id}`"
        class="flex items-center gap-4 p-4 hover:bg-paper-soft"
      >
        <div class="hidden size-16 shrink-0 overflow-hidden rounded-md bg-paper-soft sm:block">
          <img v-if="post.coverR2Key" :src="`/images/${post.coverR2Key}`" class="size-full object-cover" alt="" loading="lazy">
          <div v-else class="flex size-full items-center justify-center text-ink-soft/30"><Icon name="heroicons:document-text" class="size-6" /></div>
        </div>
        <div class="min-w-0 flex-1">
          <h3 class="truncate font-semibold text-ink">{{ post.title }}</h3>
          <p class="truncate text-sm text-ink-soft">{{ post.excerpt || '—' }}</p>
        </div>
        <UiBadge :tone="post.status === 'published' ? 'green' : 'gray'">
          {{ post.status === 'published' ? 'เผยแพร่' : 'ฉบับร่าง' }}
        </UiBadge>
        <span class="hidden w-28 text-right text-sm text-ink-soft md:block">{{ formatDate(post.publishedAt || post.createdAt) }}</span>
      </NuxtLink>
    </div>

    <div v-else-if="!pending" class="mt-6 rounded-lg border border-dashed border-line bg-white p-12 text-center">
      <Icon name="heroicons:document-text" class="mx-auto size-10 text-ink-soft/40" />
      <p class="mt-3 text-sm text-ink-soft">ยังไม่มีบทความ</p>
    </div>

    <UiModal v-model="showCreate" title="เขียนบทความใหม่">
      <form class="space-y-4" @submit.prevent="create">
        <p v-if="createErr" class="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{{ createErr }}</p>
        <UiField label="ชื่อบทความ" input-id="p-title">
          <UiTextarea id="p-title" v-model="title" required :rows="2" placeholder="เช่น สรุปกิจกรรม Workshop ถ่ายภาพ" />
        </UiField>
        <div class="flex justify-end gap-2 pt-2">
          <UiButton type="button" variant="secondary" @click="showCreate = false">ยกเลิก</UiButton>
          <UiButton type="submit" :loading="saving">สร้างและเขียนต่อ</UiButton>
        </div>
      </form>
    </UiModal>
  </div>
</template>
