<script setup lang="ts">
definePageMeta({ layout: 'site' })

const { t } = useI18n()
const localizedPath = useLocalizedContentPath()
const { data: albums } = await useAsyncData('albums-archive', async () => {
  const adminAlbums = await $fetch('/api/albums').catch(() => [])
  if (adminAlbums.length) return adminAlbums.map(album => ({ ...album, path: `/albums/${album.id}` }))
  return []
})

function coverOf(a: NonNullable<typeof albums.value>[number]) {
  return a.coverSrc || a.rows?.flatMap((r: any) => r.cells).find((c: any) => c.type === 'image' && c.src)?.src || ''
}

// Gallery section lists albums whose placement includes the gallery.
const galleryAlbums = computed(() =>
  (albums.value ?? []).filter(a => a.placement === 'gallery' || a.placement === 'both')
)

// Category index with counts, derived from the data.
const categories = computed(() => {
  const counts = new Map<string, number>()
  for (const a of galleryAlbums.value) counts.set(a.category, (counts.get(a.category) ?? 0) + 1)
  return [...counts.entries()].map(([name, count]) => ({ name, count }))
})

const activeCat = ref('all')
const filtered = computed(() =>
  activeCat.value === 'all'
    ? galleryAlbums.value
    : galleryAlbums.value.filter(a => a.category === activeCat.value)
)
const featured = computed(() => filtered.value[0] ?? null)
const rest = computed(() => filtered.value.slice(1))

function imageCount(a: NonNullable<typeof albums.value>[number]): number {
  return (a.rows ?? []).reduce((n: number, r: any) => n + r.cells.filter((c: any) => c.type === 'image').length, 0)
}
const totalFrames = computed(() => galleryAlbums.value.reduce((n, a) => n + imageCount(a), 0))
const headerBg = computed(() => (galleryAlbums.value[0] ? coverOf(galleryAlbums.value[0]) : ''))

useHead({ title: () => `${t('admin.albums')} — CU Photo Club` })
</script>

<template>
  <div>
    <!-- PAGE HEADER -->
    <header class="page-head" data-chrome-header>
      <div class="page-head__bg" data-parallax>
        <AppImg v-if="headerBg" :src="headerBg" alt="" sizes="xs:100vw sm:100vw md:100vw lg:100vw xl:100vw xxl:100vw" class="page-head__img" eager />
      </div>
      <div class="page-head__body">
        <p class="page-head__kicker">{{ t('albums.pageKicker') }}</p>
        <h1 class="page-head__title">{{ t('albums.pageTitle') }}</h1>
      </div>
      <div class="page-head__foot">
        <p class="page-head__lead">
          {{ t('albums.pageLead') }}
        </p>
        <div class="page-head__stats">
          <div>
            <div class="stat__num">{{ galleryAlbums.length }}</div>
            <div class="stat__label">{{ t('albums.collections') }}</div>
          </div>
          <div>
            <div class="stat__num">{{ totalFrames }}</div>
            <div class="stat__label">{{ t('albums.frames') }}</div>
          </div>
        </div>
      </div>
    </header>
    <div class="cut-line" />

    <!-- ARCHIVE -->
    <section class="section-pad">
      <div class="wrap">
        <div class="index-bar">
          <div>
            <div class="eyebrow"><span class="num">01</span> {{ t('albums.theArchive') }}</div>
            <h2 class="index-bar__title">{{ t('albums.sequencedBy') }}</h2>
          </div>
          <div class="filter">
            <button :class="{ active: activeCat === 'all' }" @click="activeCat = 'all'">
              {{ t('common.all') }} <sup>{{ galleryAlbums.length }}</sup>
            </button>
            <button
              v-for="cat in categories"
              :key="cat.name"
              :class="{ active: activeCat === cat.name }"
              @click="activeCat = cat.name"
            >
              {{ cat.name }} <sup>{{ cat.count }}</sup>
            </button>
          </div>
        </div>

        <!-- FEATURED / latest of the current filter -->
        <NuxtLink v-if="featured" :to="localizedPath(featured.path)" class="feature">
          <div class="feature__img">
            <span class="feature__flag">{{ t('albums.latest') }}</span>
            <AppImg :src="coverOf(featured)" :alt="featured.title" sizes="sm:100vw lg:55vw" />
          </div>
          <div class="feature__body">
            <p class="feature__cat">{{ featured.category }}</p>
            <h3 class="feature__title">{{ featured.title }}</h3>
            <p class="feature__excerpt">{{ featured.excerpt }}</p>
            <div class="feature__meta">
              <span>{{ featured.date }}</span><span class="dot" /><span>{{ t('albums.metaFrames', { count: imageCount(featured) }) }}</span>
            </div>
            <span class="feature__view">{{ t('albums.viewAlbum') }}</span>
          </div>
        </NuxtLink>

        <!-- MASONRY -->
        <div class="albums">
          <NuxtLink v-for="a in rest" :key="a.path" :to="localizedPath(a.path)" class="album">
            <div class="album__stack">
              <div class="album__cover">
                <span class="album__frames">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="6" width="18" height="14" rx="1" /><rect x="6" y="3" width="14" height="3" rx="1" /></svg>
                  {{ imageCount(a) }}
                </span>
                <AppImg :src="coverOf(a)" :alt="a.title" sizes="sm:100vw md:50vw lg:33vw" />
                <div class="album__view">{{ t('albums.viewAlbum') }}</div>
              </div>
            </div>
            <p class="album__cat">{{ a.category }}</p>
            <h3 class="album__title">{{ a.title }}</h3>
            <p class="album__date">{{ a.date }}</p>
          </NuxtLink>
        </div>
        <p v-if="filtered.length === 0" class="empty">{{ t('albums.noAlbums') }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page-head {
  min-height: 64svh;
  background: var(--hero-bg);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}
.page-head__bg { position: absolute; inset: 0; will-change: transform; }
.page-head__bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(12, 12, 10, 0.55) 0%, rgba(12, 12, 10, 0.2) 40%, rgba(12, 12, 10, 0.9) 100%);
}
:deep(.page-head__img) { width: 100%; height: 100%; object-fit: cover; opacity: 0.32; display: block; }
.page-head__body { position: relative; z-index: 2; padding: 0 3rem 0; max-width: 1380px; margin: 0 auto; width: 100%; }
.page-head__kicker { font-size: 0.56rem; letter-spacing: 0.3em; text-transform: uppercase; color: rgba(245, 244, 240, 0.5); margin-bottom: 1.5rem; }
.page-head__kicker span { color: var(--accent); }
.page-head__title { font-family: var(--font-serif); font-size: clamp(3.5rem, 8vw, 8.5rem); font-weight: 200; line-height: 0.9; letter-spacing: -0.03em; color: #F5F4F0; }
.page-head__title em { font-style: italic; font-weight: 200; color: var(--accent); }
.page-head__foot {
  position: relative; z-index: 2; margin: 3rem auto 0; display: grid;
  grid-template-columns: 1fr auto; align-items: end; gap: 3rem;
  padding: 0 3rem 3rem; max-width: 1380px; width: 100%;
}
.page-head__lead { font-size: 0.82rem; color: rgba(245, 244, 240, 0.5); line-height: 1.85; max-width: 420px; }
.page-head__stats { text-align: right; display: flex; gap: 2.5rem; }
.stat__num { font-family: var(--font-serif); font-size: 2.6rem; font-weight: 200; color: #F5F4F0; line-height: 1; }
.stat__label { font-size: 0.52rem; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(245, 244, 240, 0.4); margin-top: 0.6rem; }

.section-pad { padding: 5rem 3rem 6rem; }
.wrap { max-width: 1380px; margin: 0 auto; }

.index-bar { display: flex; align-items: flex-end; justify-content: space-between; gap: 2rem; flex-wrap: wrap; margin-bottom: 3.5rem; }
.eyebrow { font-size: 0.54rem; letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted); display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.25rem; }
.eyebrow .num { color: var(--accent); font-weight: 500; }
.index-bar__title { font-family: var(--font-serif); font-size: clamp(1.6rem, 2.4vw, 2.3rem); font-weight: 300; letter-spacing: -0.02em; line-height: 1.1; }
.index-bar__title em { font-style: italic; color: var(--accent); }

.filter { display: flex; flex-wrap: wrap; gap: 0.4rem 1.6rem; max-width: 680px; justify-content: flex-end; }
.filter button { background: none; border: none; cursor: pointer; font-family: var(--font-sans); font-size: 0.6rem; font-weight: 400; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted); padding: 0.35rem 0; position: relative; transition: color 0.2s; }
.filter button:hover { color: var(--dark); }
.filter button sup { font-size: 0.78em; color: var(--subtle); margin-left: 0.2em; transition: color 0.2s; }
.filter button:hover sup { color: var(--muted); }
.filter button.active { color: var(--accent); }
.filter button.active sup { color: var(--accent); }
.filter button.active::after { content: ''; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; background: var(--accent); }

.feature { display: grid; grid-template-columns: 1.45fr 1fr; gap: 0; margin-bottom: 4.5rem; background: var(--hero-bg); cursor: pointer; overflow: hidden; text-decoration: none; }
.feature__img { position: relative; overflow: hidden; min-height: 460px; }
.feature__img :deep(img) { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.feature:hover .feature__img :deep(img) { transform: scale(1.04); }
.feature__flag { position: absolute; top: 1.5rem; left: 1.5rem; z-index: 2; font-size: 0.5rem; letter-spacing: 0.24em; text-transform: uppercase; color: #F5F4F0; background: var(--accent); padding: 0.5rem 0.85rem; }
.feature__body { padding: 3rem; display: flex; flex-direction: column; justify-content: center; color: #F5F4F0; }
.feature__cat { font-size: 0.54rem; letter-spacing: 0.24em; text-transform: uppercase; color: var(--accent); margin-bottom: 1.25rem; }
.feature__title { font-family: var(--font-serif); font-size: clamp(2rem, 3.2vw, 3.2rem); font-weight: 300; line-height: 1.05; letter-spacing: -0.02em; margin-bottom: 1.5rem; }
.feature__excerpt { font-size: 0.82rem; color: rgba(245, 244, 240, 0.52); line-height: 1.85; margin-bottom: 2rem; max-width: 420px; }
.feature__meta { display: flex; align-items: center; gap: 1.5rem; font-size: 0.58rem; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(245, 244, 240, 0.45); margin-bottom: 2rem; }
.feature__meta .dot { width: 3px; height: 3px; border-radius: 50%; background: var(--accent); }
.feature__view { font-size: 0.58rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--accent); width: fit-content; border-bottom: 1px solid rgba(232, 24, 110, 0.35); padding-bottom: 3px; transition: border-color 0.2s; }
.feature:hover .feature__view { border-color: var(--accent); }

.albums { column-count: 3; column-gap: 1.5rem; }
.album { break-inside: avoid; margin-bottom: 2.75rem; cursor: pointer; display: block; text-decoration: none; color: var(--dark); }
.album__stack { position: relative; margin-bottom: 1.1rem; }
.album__stack::before, .album__stack::after { content: ''; position: absolute; inset: 0; background: var(--paper); border: 1px solid var(--subtle); z-index: 0; transition: transform 0.45s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.album__stack::before { transform: translate(6px, 6px); }
.album__stack::after { transform: translate(11px, 11px); opacity: 0.6; }
.album:hover .album__stack::before { transform: translate(10px, 10px); }
.album:hover .album__stack::after { transform: translate(18px, 18px); }
.album__cover { position: relative; z-index: 1; overflow: hidden; background: var(--hero-bg); }
.album__cover :deep(img) { width: 100%; display: block; object-fit: cover; transition: transform 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94); }
.album:hover .album__cover :deep(img) { transform: scale(1.05); }
.album__frames { position: absolute; top: 0.85rem; right: 0.85rem; z-index: 2; display: flex; align-items: center; gap: 0.4rem; font-size: 0.5rem; letter-spacing: 0.16em; text-transform: uppercase; color: #F5F4F0; background: rgba(12, 12, 10, 0.55); backdrop-filter: blur(4px); padding: 0.4rem 0.6rem; transition: background 0.25s; }
.album:hover .album__frames { background: var(--accent); }
.album__frames svg { width: 9px; height: 9px; display: block; }
.album__view { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 2.5rem 1rem 1rem; background: linear-gradient(transparent, rgba(12, 12, 10, 0.8)); font-size: 0.54rem; letter-spacing: 0.22em; text-transform: uppercase; color: #F5F4F0; opacity: 0; transform: translateY(8px); transition: opacity 0.3s, transform 0.3s; }
.album:hover .album__view { opacity: 1; transform: translateY(0); }
.album__cat { font-size: 0.52rem; letter-spacing: 0.22em; text-transform: uppercase; color: var(--accent); margin-bottom: 0.55rem; }
.album__title { font-family: var(--font-serif); font-size: 1.3rem; font-weight: 400; line-height: 1.2; letter-spacing: -0.01em; margin-bottom: 0.6rem; transition: color 0.2s; }
.album:hover .album__title { color: var(--accent); }
.album__date { font-size: 0.58rem; letter-spacing: 0.1em; color: var(--muted); }

.empty { text-align: center; padding: 4rem 0; font-family: var(--font-serif); font-style: italic; font-size: 1.2rem; color: var(--muted); }

@media (max-width: 1000px) {
  .albums { column-count: 2; }
  .feature { grid-template-columns: 1fr; }
  .feature__img { min-height: 320px; }
}
@media (max-width: 720px) {
  .section-pad { padding: 4rem 1.5rem 5rem; }
  .page-head__body, .page-head__foot { padding-left: 1.5rem; padding-right: 1.5rem; }
  .page-head__foot { grid-template-columns: 1fr; }
  .page-head__stats { justify-content: flex-start; }
  .albums { column-count: 1; }
  .filter { justify-content: flex-start; }
  .index-bar { flex-direction: column; align-items: flex-start; }
}
</style>
