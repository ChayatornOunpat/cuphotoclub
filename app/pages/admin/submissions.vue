<script setup lang="ts">
// Collections overview, laid out like the albums index: page header, the
// create form on top, existing collections below. The photos themselves live
// one level down, on each collection's own pool page.
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()
const localePath = useLocalePath()

useHead(() => ({ title: t('adminPool.title') }))
</script>

<template>
  <div class="admin-wrap">
    <div class="page-head">
      <div>
        <NuxtLink :to="localePath('/admin')" class="back">{{ t('admin.dashboard') }}</NuxtLink>
        <h1>{{ t('adminPool.title') }}</h1>
        <p class="sub">{{ t('adminPool.sub') }}</p>
      </div>
    </div>

    <AdminCollectionLinks />
  </div>
</template>

<style scoped>
.admin-wrap { max-width: 1120px; margin: 0 auto; padding: 3rem 2rem 5rem; }
.page-head { display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 2.5rem; gap: 1.5rem; }
.page-head h1 { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 200; margin-top: 0.5rem; }
.back { display: inline-block; font-size: 0.58rem; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); text-decoration: none; }
.back:hover { color: var(--accent); }
.sub { font-size: 0.7rem; letter-spacing: 0.1em; color: var(--muted); margin-top: 0.35rem; }
</style>
