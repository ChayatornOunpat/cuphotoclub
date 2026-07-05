<script setup lang="ts">
interface PostRow {
  id: number
  slug: string
  title: string
  excerpt: string | null
  coverR2Key: string | null
  publishedAt: string | null
}

const { data: posts } = await useFetch<PostRow[]>('/api/posts')

useSeoMeta({
  title: 'บทความ',
  description: 'ข่าวสารและบทความจากชมรมถ่ายภาพ'
})

const pageSize = 30
const page = ref(1)
const totalPages = computed(() => Math.max(1, Math.ceil((posts.value?.length ?? 0) / pageSize)))
watch(totalPages, () => {
  if (page.value > totalPages.value) page.value = totalPages.value
})
const paged = computed(() => (posts.value ?? []).slice((page.value - 1) * pageSize, page.value * pageSize))

function goToPage(n: number) {
  page.value = Math.min(Math.max(1, n), totalPages.value)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink">บทความ</h1>
      <p class="mt-3 text-ink-soft">ข่าวสาร เรื่องเล่า และเทคนิคการถ่ายภาพ</p>
    </header>

    <div v-if="posts && posts.length" class="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <PublicPostCard v-for="post in paged" :key="post.id" :post="post" />
    </div>

    <div v-else class="mt-16 text-center text-ink-soft">
      <Icon name="heroicons:document-text" class="mx-auto size-12 text-ink-soft/30" />
      <p class="mt-4">ยังไม่มีบทความที่เผยแพร่</p>
    </div>

    <nav v-if="totalPages > 1" class="mt-14 flex items-center justify-center gap-8 border-t border-line pt-8" aria-label="Pagination">
      <button
        type="button"
        class="text-xs font-medium uppercase tracking-widest text-ink transition hover:text-accent disabled:cursor-default disabled:text-ink-soft/40 disabled:hover:text-ink-soft/40"
        :disabled="page === 1"
        @click="goToPage(page - 1)"
      >
        ← ก่อนหน้า
      </button>
      <span class="text-xs uppercase tracking-widest text-ink-soft">หน้า {{ page }} จาก {{ totalPages }}</span>
      <button
        type="button"
        class="text-xs font-medium uppercase tracking-widest text-ink transition hover:text-accent disabled:cursor-default disabled:text-ink-soft/40 disabled:hover:text-ink-soft/40"
        :disabled="page === totalPages"
        @click="goToPage(page + 1)"
      >
        ถัดไป →
      </button>
    </nav>
  </div>
</template>
