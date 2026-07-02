<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const [{ data: albums }, { data: posts }, { data: members }, { data: heroImages }] = await Promise.all([
  useFetch('/api/admin/albums'),
  useFetch('/api/admin/posts'),
  useFetch('/api/admin/members'),
  useFetch('/api/admin/hero-images')
])

const sections = computed(() => [
  {
    key: 'albums',
    title: t('admin.albums'),
    count: albums.value?.length ?? 0,
    meta: t('admin.galleryWork'),
    to: localePath('/admin/albums'),
    newTo: localePath('/admin/albums/new'),
    quickLabel: t('admin.newAlbum')
  },
  {
    key: 'posts',
    title: t('admin.posts'),
    count: posts.value?.length ?? 0,
    meta: t('admin.editorialWriting'),
    to: localePath('/admin/posts'),
    newTo: localePath('/admin/posts/new'),
    quickLabel: t('admin.newPost')
  },
  {
    key: 'members',
    title: t('admin.membersTitle'),
    count: members.value?.length ?? 0,
    meta: t('admin.memberWork'),
    to: localePath('/admin/members'),
    newTo: localePath('/admin/members'),
    quickLabel: t('admin.manageMembers')
  },
  {
    key: 'heroImages',
    title: t('admin.heroImagesTitle'),
    count: heroImages.value?.images?.length ?? 0,
    meta: t('admin.heroImagesMeta'),
    to: localePath('/admin/hero-images'),
    newTo: localePath('/admin/hero-images'),
    quickLabel: t('admin.heroImagesTitle')
  }
])

useHead({ title: () => `${t('admin.dashboard')} - Admin` })
</script>

<template>
  <div class="admin-wrap">
  <section class="dash">
    <div class="dash__head">
      <p class="kicker">{{ t('admin.brand') }}</p>
      <h1>{{ t('admin.dashboard') }}</h1>
      <p>{{ t('admin.dashboardLead') }}</p>
    </div>

    <div class="dash__tabs" role="list">
      <NuxtLink v-for="section in sections" :key="section.key" :to="section.to" class="tab" role="listitem">
        <span class="tab__count">{{ section.count }}</span>
        <span>
          <strong>{{ section.title }}</strong>
          <small>{{ section.meta }}</small>
        </span>
      </NuxtLink>
    </div>

    <div class="quick">
      <NuxtLink v-for="section in sections" :key="section.key" :to="section.newTo" class="quick__action">
        {{ section.quickLabel }}
      </NuxtLink>
    </div>
  </section>
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.dash { display: grid; gap: 2rem; }
.dash__head { max-width: 720px; }
.kicker { color: var(--accent); font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 1rem; }
.dash__head h1 { font-family: var(--font-serif); font-size: clamp(3rem, 7vw, 6.5rem); line-height: 0.95; font-weight: 200; margin-bottom: 1rem; }
.dash__head p:last-child { color: var(--muted); line-height: 1.8; max-width: 560px; }
.dash__tabs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--subtle); }
.tab { display: grid; grid-template-columns: auto 1fr; gap: 1.25rem; padding: 1.5rem 0; color: var(--dark); text-decoration: none; border-bottom: 1px solid var(--subtle); transition: color 0.2s; }
.tab:not(:first-child) { padding-left: 1.5rem; border-left: 1px solid var(--subtle); }
.tab:not(:last-child) { padding-right: 1.5rem; }
.tab:hover { color: var(--accent); }
.tab__count { font-family: var(--font-serif); font-size: 3rem; line-height: 0.9; font-weight: 200; }
.tab strong { display: block; font-weight: 500; margin-bottom: 0.35rem; }
.tab small { color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
.quick { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.quick__action { font-size: 0.6rem; letter-spacing: 0.18em; text-transform: uppercase; padding: 0.75rem 1.25rem; background: var(--dark); color: #F5F4F0; text-decoration: none; transition: background 0.2s; }
.quick__action:hover { background: var(--accent); }
@media (max-width: 720px) {
  .dash__tabs { grid-template-columns: 1fr; }
  .tab:nth-child(n) { padding-left: 0; padding-right: 0; border-left: 0; }
}
@media (min-width: 721px) and (max-width: 960px) {
  .dash__tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .tab:nth-child(odd) { padding-left: 0; border-left: 0; }
  .tab:nth-child(n+3) { border-top: 1px solid var(--subtle); }
}
</style>
