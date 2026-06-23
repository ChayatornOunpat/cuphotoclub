<script setup lang="ts">
const { data: page } = await useFetch<{ title: string, bodyHtml: string }>('/api/pages/about')

useSeoMeta({
  title: () => page.value?.title || 'เกี่ยวกับเรา',
  description: 'เกี่ยวกับชมรมถ่ายภาพและทีมงาน'
})
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-12 sm:py-16">
    <h1 class="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{{ page?.title }}</h1>
    <div
      v-if="page?.bodyHtml"
      class="prose prose-zinc mt-8 max-w-none prose-a:text-accent prose-img:rounded-lg"
      v-html="page.bodyHtml"
    />
    <p v-else class="mt-8 text-ink-soft">เนื้อหากำลังจะมาเร็ว ๆ นี้</p>
  </div>
</template>
