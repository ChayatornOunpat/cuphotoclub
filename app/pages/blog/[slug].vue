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

// og:image must be an absolute URL or link-preview scrapers ignore it.
const origin = useRequestURL().origin
const coverUrl = computed(() => {
  const src = post.value?.image
  if (!src) return undefined
  return /^https?:\/\//i.test(src) ? src : `${origin}${src.startsWith('/') ? '' : '/images/'}${src}`
})

useSeoMeta({
  title: () => post.value!.title.replace(/\n+/g, ' '),
  ogTitle: () => post.value!.title.replace(/\n+/g, ' '),
  description: () => (post.value!.excerpt || post.value!.title).replace(/\n+/g, ' '),
  ogDescription: () => (post.value!.excerpt || post.value!.title).replace(/\n+/g, ' '),
  ogImage: () => coverUrl.value,
  ogType: 'article',
  twitterCard: () => (coverUrl.value ? 'summary_large_image' : 'summary')
})

// Article structured data for rich results in search.
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: post.value!.title.replace(/\n+/g, ' '),
        description: (post.value!.excerpt || post.value!.title).replace(/\n+/g, ' '),
        image: coverUrl.value ? [coverUrl.value] : undefined,
        datePublished: post.value!.published || undefined,
        dateModified: post.value!.updatedAt || post.value!.published || undefined,
        author: post.value!.author
          ? { '@type': 'Person', name: post.value!.author }
          : { '@type': 'Organization', name: 'CU Photo Club' },
        publisher: {
          '@type': 'Organization',
          name: 'CU Photo Club',
          logo: { '@type': 'ImageObject', url: `${origin}/club-icon.jpg` }
        },
        url: `${origin}/blog/${post.value!.id}`
      })
    }
  ]
}))
</script>

<template>
  <div v-if="post">
    <div class="mx-auto max-w-3xl px-4 pt-12 sm:pt-16">
      <NuxtLink to="/blog" class="inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        <Icon name="heroicons:arrow-left" class="size-4" /> {{ t('blog.backToPosts') }}
      </NuxtLink>
    </div>
    <PublicPostArticle :post="post" />
  </div>
</template>
