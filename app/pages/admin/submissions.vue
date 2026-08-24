<script setup lang="ts">
// Collections overview: every share link, its stats, and the controls to
// create/tune/close it. The photos themselves live one level down, on each
// collection's own pool page — this page stays a compact index even when the
// pools hold thousands of photos.
definePageMeta({ layout: 'admin', middleware: 'admin' })

const { t } = useI18n()

useHead(() => ({ title: t('adminPool.title') }))
</script>

<template>
  <div class="collections">
    <header class="collections__head">
      <h1 class="collections__title">{{ t('adminPool.title') }}</h1>
      <p class="collections__sub">{{ t('adminPool.sub') }}</p>
    </header>

    <AdminCollectionLinks />
  </div>
</template>

<style scoped>
.collections {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}
.collections__head { display: flex; flex-direction: column; gap: 0.3rem; }
.collections__title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  color: var(--dark);
}
.collections__sub { font-family: var(--font-sans); font-size: 0.72rem; color: var(--muted); max-width: 62ch; }
</style>
