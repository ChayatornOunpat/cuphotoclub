<script setup lang="ts">
import type { Post } from '~~/shared/types'

definePageMeta({ layout: 'site' })

const { t } = useI18n()
const { data: posts } = await useFetch<Post[]>('/api/posts')

useSeoMeta({
  title: () => t('posts.pageTitle'),
  description: () => t('posts.pageLead')
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
  <div class="blog-page">

    <!-- Page header -->
    <header class="page-head">
      <p class="page-head__kicker">{{ t('posts.kicker') }}</p>
      <h1 class="page-head__title">{{ t('posts.pageTitle') }}</h1>
      <p class="page-head__lead">{{ t('posts.pageLead') }}</p>
    </header>

    <div class="blog-body">
      <section v-if="posts && posts.length" class="cards" aria-label="Posts">
        <PublicPostCard v-for="post in paged" :key="post.id" :post="post" />
      </section>

      <div v-else class="empty">
        <Icon name="heroicons:document-text" />
        <p>{{ t('posts.empty') }}</p>
      </div>

      <nav v-if="totalPages > 1" class="pager" aria-label="Pagination">
        <button type="button" class="pager__nav" :disabled="page === 1" @click="goToPage(page - 1)">
          {{ t('posts.prev') }}
        </button>
        <span class="pager__status">{{ t('posts.pageOf', { page, total: totalPages }) }}</span>
        <button type="button" class="pager__nav" :disabled="page === totalPages" @click="goToPage(page + 1)">
          {{ t('posts.next') }}
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.blog-page {
  min-height: 100vh;
}

/* ── Page header ── */
.page-head {
  padding: 10rem 3rem 5rem;
  max-width: 1380px;
  margin: 0 auto;
  border-bottom: 1px solid var(--subtle);
}
.page-head__kicker {
  font-size: 0.54rem;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1.5rem;
}
.page-head__title {
  font-family: var(--font-serif);
  font-size: clamp(3rem, 7vw, 7rem);
  font-weight: 200;
  line-height: 0.98;
  letter-spacing: -0.01em;
  color: var(--dark);
  margin-bottom: 1.5rem;
}
.page-head__lead {
  font-size: 0.9rem;
  color: var(--muted);
  max-width: 480px;
  line-height: 1.8;
}

/* ── Body wrapper ── */
.blog-body {
  max-width: 1380px;
  margin: 0 auto;
  padding: 4rem 3rem 8rem;
}

/* ── Post cards ── */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 2rem 1.5rem;
}

/* ── Empty state ── */
.empty {
  border: 1px dashed var(--subtle);
  padding: 4rem 2rem;
  text-align: center;
  color: var(--muted);
}
.empty :deep(svg) {
  width: 2.2rem;
  height: 2.2rem;
  opacity: 0.4;
}
.empty p {
  margin-top: 0.9rem;
  font-size: 0.78rem;
}

/* ── Pagination ── */
.pager {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  margin-top: 3.5rem;
  padding-top: 2.5rem;
  border-top: 1px solid var(--subtle);
}
.pager__nav {
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.6rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--dark);
  transition: color 0.2s;
}
.pager__nav:hover:not(:disabled) { color: var(--accent); }
.pager__nav:disabled { color: var(--subtle); cursor: default; }
.pager__status {
  font-size: 0.6rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

/* ── Responsive ── */
@media (max-width: 760px) {
  .page-head { padding: 7rem 1.25rem 3rem; }
  .blog-body { padding: 2.5rem 1.25rem 5rem; }
  .cards { grid-template-columns: 1fr 1fr; gap: 1.5rem 1rem; }
}
</style>
