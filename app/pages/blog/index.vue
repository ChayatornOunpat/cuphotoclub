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
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink">บทความ</h1>
      <p class="mt-3 text-ink-soft">ข่าวสาร เรื่องเล่า และเทคนิคการถ่ายภาพ</p>
    </header>

    <div v-if="posts && posts.length" class="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <PublicPostCard v-for="post in posts" :key="post.id" :post="post" />
    </div>

    <div v-else class="mt-16 text-center text-ink-soft">
      <Icon name="heroicons:document-text" class="mx-auto size-12 text-ink-soft/30" />
      <p class="mt-4">ยังไม่มีบทความที่เผยแพร่</p>
    </div>
  </div>
</template>
