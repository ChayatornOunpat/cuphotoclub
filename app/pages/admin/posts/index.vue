<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const { data: posts, refresh } = await useFetch('/api/admin/posts')
const deleting = ref('')
const query = ref('')
const sortBy = ref('newest')
const viewMode = ref<'list' | 'cards'>('list')

function visibilityLabel(value?: string) {
  if (value === 'draft') return 'Draft'
  if (value === 'link-only') return 'Link only'
  return 'Public'
}

function visibilityClass(value?: string) {
  return {
    'pill--draft': value === 'draft',
    'pill--link': value === 'link-only',
    'pill--public': !value || value === 'public'
  }
}

function previewPath(post: NonNullable<typeof posts.value>[number]) {
  return post.visibility === 'draft' ? `/admin/posts/${post.id}/preview` : `/posts/${post.id}`
}

function actorName(actor?: { name?: string | null, email?: string } | null) {
  return actor?.name || actor?.email || 'Unknown'
}

function modifiedValue(post: NonNullable<typeof posts.value>[number]) {
  return post.updatedAt || post.published
}

const visiblePosts = computed(() => {
  const q = query.value.trim().toLowerCase()
  const rows = [...(posts.value ?? [])]
    .filter((post) => {
      if (!q) return true
      const blockText = (post.blocks ?? []).map((b: any) =>
        b.content ?? b.question ?? b.answer ?? b.caption ?? ''
      ).join(' ')
      return [post.title, post.tag, post.excerpt, blockText]
        .some(value => String(value ?? '').toLowerCase().includes(q))
    })

  return rows.sort((a, b) => {
    if (sortBy.value === 'modified') return modifiedValue(b).localeCompare(modifiedValue(a))
    if (sortBy.value === 'oldest') return a.published.localeCompare(b.published)
    if (sortBy.value === 'title') return a.title.localeCompare(b.title)
    if (sortBy.value === 'tag') return a.tag.localeCompare(b.tag)
    return b.published.localeCompare(a.published)
  })
})

async function del(id: string, title: string) {
  if (!confirm(t('admin.deleteConfirm', { title }))) return
  deleting.value = id
  try {
    await $fetch(`/api/admin/posts/${id}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    alert((e as { data?: { statusMessage?: string } })?.data?.statusMessage || t('admin.deleteFailed'))
  } finally {
    deleting.value = ''
  }
}

useHead({ title: () => `${t('admin.posts')} - Admin` })
</script>

<template>
  <div class="admin-wrap">
    <div class="page-head">
      <div>
        <NuxtLink :to="localePath('/admin')" class="back">{{ t('admin.dashboard') }}</NuxtLink>
        <h1>{{ t('admin.posts') }}</h1>
        <p class="sub">{{ t((posts?.length ?? 0) === 1 ? 'admin.postCount' : 'admin.postCountOther', { count: posts?.length ?? 0 }) }}</p>
      </div>
      <NuxtLink :to="localePath('/admin/posts/new')" class="btn-solid">{{ t('admin.newPost') }}</NuxtLink>
    </div>

    <div v-if="posts && posts.length" class="tools">
      <label class="search">
        <span>{{ t('admin.search') }}</span>
        <input v-model="query" type="search" :placeholder="t('admin.searchPosts')">
      </label>
      <label class="sort">
        <span>{{ t('admin.sortBy') }}</span>
        <select v-model="sortBy">
          <option value="newest">{{ t('admin.sortNewest') }}</option>
          <option value="modified">{{ t('admin.sortModified') }}</option>
          <option value="oldest">{{ t('admin.sortOldest') }}</option>
          <option value="title">{{ t('admin.sortTitle') }}</option>
          <option value="tag">{{ t('admin.sortTag') }}</option>
        </select>
      </label>
      <div class="toggle" role="group" :aria-label="t('admin.viewMode')">
        <button type="button" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">{{ t('admin.viewList') }}</button>
        <button type="button" :class="{ active: viewMode === 'cards' }" @click="viewMode = 'cards'">{{ t('admin.viewCards') }}</button>
      </div>
    </div>

    <p v-if="posts && posts.length" class="result-count">{{ t('admin.showingCount', { shown: visiblePosts.length, total: posts.length }) }}</p>

    <table v-if="posts && posts.length && visiblePosts.length && viewMode === 'list'" class="tbl">
      <thead>
        <tr><th>{{ t('admin.tableTitle') }}</th><th>{{ t('admin.tableTag') }}</th><th>Visibility</th><th>Created by</th><th>Last edited by</th><th>{{ t('admin.tableDate') }}</th><th /></tr>
      </thead>
      <tbody>
        <tr v-for="p in visiblePosts" :key="p.id">
          <td class="t-title">{{ p.title }}</td>
          <td><span class="pill">{{ p.tag }}</span></td>
          <td><span class="pill" :class="visibilityClass(p.visibility)">{{ visibilityLabel(p.visibility) }}</span></td>
          <td class="t-muted">{{ actorName(p.createdBy) }}</td>
          <td class="t-muted">{{ actorName(p.updatedBy) }}</td>
          <td class="t-muted">{{ p.date }}</td>
          <td class="t-actions">
            <NuxtLink :to="localePath(previewPath(p))" class="link" target="_blank" rel="noopener noreferrer">{{ t('admin.preview') }}</NuxtLink>
            <NuxtLink :to="localePath(`/admin/posts/${p.id}`)" class="link">{{ t('admin.edit') }}</NuxtLink>
            <button class="link link--del" :disabled="deleting === p.id" @click="del(p.id, p.title)">
              {{ deleting === p.id ? '...' : t('admin.delete') }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <section v-else-if="posts && posts.length && visiblePosts.length" class="cards">
      <article v-for="p in visiblePosts" :key="p.id" class="card">
        <img :src="p.image" :alt="p.title">
        <div class="card__body">
          <p class="card__meta">{{ p.tag }} · {{ p.date }}</p>
          <h2>{{ p.title }}</h2>
          <p>{{ p.excerpt }}</p>
          <div class="card__facts">
            <span :class="visibilityClass(p.visibility)">{{ visibilityLabel(p.visibility) }}</span>
            <span>Created by {{ actorName(p.createdBy) }}</span>
            <span>Edited by {{ actorName(p.updatedBy) }}</span>
          </div>
          <div class="card__actions">
            <NuxtLink :to="localePath(previewPath(p))" class="link" target="_blank" rel="noopener noreferrer">{{ t('admin.preview') }}</NuxtLink>
            <NuxtLink :to="localePath(`/admin/posts/${p.id}`)" class="link">{{ t('admin.edit') }}</NuxtLink>
            <button class="link link--del" :disabled="deleting === p.id" @click="del(p.id, p.title)">
              {{ deleting === p.id ? '...' : t('admin.delete') }}
            </button>
          </div>
        </div>
      </article>
    </section>

    <p v-else-if="posts && posts.length" class="empty">{{ t('admin.noMatches') }}</p>
    <p v-else class="empty">{{ t('admin.noPosts') }} <NuxtLink :to="localePath('/admin/posts/new')">{{ t('admin.createFirstPost') }}</NuxtLink></p>
  </div>
</template>


<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; gap: 1.5rem; }
.page-head h1 { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; margin-top: 0.5rem; }
.back { display: inline-block; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.sub { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--muted); margin-top: 0.35rem; }
.btn-solid { font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.7rem 1.5rem; background: var(--dark); color: #F5F4F0; border: none; cursor: pointer; text-decoration: none; transition: background 0.2s; }
.btn-solid:hover { background: var(--accent); }
.tools { display: grid; grid-template-columns: minmax(220px, 1fr) 190px auto; gap: 0.75rem; align-items: end; margin-bottom: 0.8rem; }
.search, .sort { display: flex; flex-direction: column; gap: 0.35rem; }
.search span, .sort span { font-size: 0.52rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); }
.search input, .sort select { min-height: 2.35rem; border: 1px solid var(--subtle); background: #fff; color: var(--dark); font-family: var(--font-sans); font-size: 0.82rem; padding: 0 0.7rem; outline: none; }
.search input:focus, .sort select:focus { border-color: var(--accent); }
.toggle { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid var(--subtle); background: #fff; min-height: 2.35rem; }
.toggle button { border: 0; background: transparent; padding: 0 0.85rem; color: var(--muted); font-family: var(--font-sans); font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; cursor: pointer; }
.toggle button + button { border-left: 1px solid var(--subtle); }
.toggle button.active { background: var(--dark); color: #F5F4F0; }
.result-count { color: var(--muted); font-size: 0.72rem; margin-bottom: 1.2rem; }
.tbl { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
.tbl th { text-align: left; font-size: 0.5rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted); font-weight: 500; padding: 0 0.75rem 0.85rem; border-bottom: 1px solid var(--subtle); }
.tbl td { padding: 0.9rem 0.75rem; border-bottom: 1px solid var(--subtle); vertical-align: middle; }
.t-title { font-weight: 500; }
.t-muted { color: var(--muted); }
.pill { font-size: 0.58rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); border: 1px solid var(--subtle); padding: 0.2rem 0.5rem; }
.pill--draft { color: #b0243c; }
.pill--link { color: #6b7fd4; }
.pill--public { color: var(--accent); }
.t-actions { text-align: right; white-space: nowrap; }
.link { font-family: var(--font-sans); font-size: 0.7rem; letter-spacing: 0.05em; background: none; border: none; cursor: pointer; color: var(--dark); text-decoration: none; margin-left: 1rem; transition: color 0.2s; }
.link:hover { color: var(--accent); }
.link--del { color: var(--muted); }
.empty { color: var(--muted); font-size: 0.9rem; }
.empty a { color: var(--accent); }
.cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.card { display: grid; grid-template-columns: 180px 1fr; border-top: 1px solid var(--subtle); padding-top: 1rem; gap: 1rem; min-width: 0; }
.card img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; background: var(--paper); }
.card__body { min-width: 0; }
.card__meta { color: var(--accent); font-size: 0.56rem; letter-spacing: 0.16em; text-transform: uppercase; margin-bottom: 0.45rem; }
.card h2 { font-family: var(--font-serif); font-size: 1.35rem; line-height: 1.15; font-weight: 300; margin-bottom: 0.55rem; }
.card__body > p:not(.card__meta) { color: var(--muted); font-size: 0.82rem; line-height: 1.6; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card__facts { display: flex; flex-wrap: wrap; gap: 0.35rem; margin: 0.8rem 0 0; }
.card__facts span { border: 1px solid var(--subtle); color: var(--muted); font-size: 0.56rem; letter-spacing: 0.1em; text-transform: uppercase; padding: 0.2rem 0.45rem; }
.card__facts .pill--draft { color: #b0243c; }
.card__facts .pill--link { color: #6b7fd4; }
.card__facts .pill--public { color: var(--accent); }
.card__actions { display: flex; justify-content: flex-start; flex-wrap: wrap; gap: 0.8rem; margin-top: 0.9rem; }
.card__actions .link { margin-left: 0; }
@media (max-width: 760px) {
  .page-head { align-items: flex-start; flex-direction: column; }
  .tools { grid-template-columns: 1fr; }
  .cards { grid-template-columns: 1fr; }
  .card { grid-template-columns: 120px 1fr; }
  .tbl { display: block; overflow-x: auto; }
}
@media (max-width: 520px) {
  .card { grid-template-columns: 1fr; }
}
</style>
