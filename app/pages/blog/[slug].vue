<script setup lang="ts">
import type { Post } from '~~/shared/types'

definePageMeta({ layout: 'site' })

const { t } = useI18n()
const route = useRoute()
const slug = route.params.slug as string

const { data: post, error } = await useFetch<Post>(`/api/posts/${slug}`)
if (error.value || !post.value) {
  throw createError({ statusCode: 404, statusMessage: 'ไม่พบบทความ', fatal: true })
}

useSeoMeta({
  title: () => post.value!.title.replace(/\n+/g, ' '),
  description: () => (post.value!.excerpt || post.value!.title).replace(/\n+/g, ' '),
  ogImage: () => post.value!.image || undefined
})
</script>

<template>
  <div v-if="post">
    <div class="mx-auto max-w-3xl px-4 pt-8">
      <NuxtLink to="/blog" class="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <Icon name="heroicons:arrow-left" class="size-4" /> {{ t('blog.backToPosts') }}
      </NuxtLink>
    </div>
    <PublicPostArticle :post="post" />
  </div>
</template>
