<script setup lang="ts">
interface FeedItem {
  kind: 'album' | 'post'
  title: string
  tag: string
  date: string
  image: string
  excerpt: string
  path: string
}

defineProps<{
  lead: FeedItem | null
  items: FeedItem[]
}>()
const { t } = useI18n()
</script>

<template>
  <section id="stories" class="stories">
    <div class="wrap">
      <div class="eyebrow"><span class="num">02</span> {{ t('home.latest') }}</div>
      <div class="stories__layout">
        <!-- Lead: newest item, album or post -->
        <NuxtLink v-if="lead" :to="lead.path" class="scard-lead">
          <div class="scard-lead__img">
            <AppImg :src="lead.image" :alt="lead.title" width="1200" height="900" sizes="sm:100vw lg:55vw" />
          </div>
          <div class="scard-lead__body">
            <p class="scard-lead__tag">{{ lead.tag }}</p>
            <h3 class="scard-lead__title">{{ lead.title }}</h3>
            <p class="scard-lead__excerpt">{{ lead.excerpt }}</p>
            <span class="scard-lead__read">{{ lead.kind === 'album' ? t('common.viewAlbum') : t('common.readEssay') }}</span>
          </div>
        </NuxtLink>

        <!-- Smaller cards: the rest of the feed -->
        <NuxtLink v-for="item in items" :key="item.path" :to="item.path" class="scard">
          <div class="scard__img">
            <AppImg :src="item.image" :alt="item.title" width="800" height="550" sizes="sm:100vw lg:22vw" />
          </div>
          <p class="scard__tag">{{ item.tag }}</p>
          <h3 class="scard__title">{{ item.title }}</h3>
          <p class="scard__date">{{ item.date }}</p>
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

<style scoped>
.stories {
  background: var(--paper);
  border-top: 1px solid var(--subtle);
  border-bottom: 1px solid var(--subtle);
  padding: 6rem 3rem;
}
.stories__layout {
  display: grid;
  grid-template-columns: 1.6fr 1fr 1fr;
  gap: 1.5rem;
  align-items: stretch;
}

/* Lead — dark card */
.scard-lead {
  background: var(--hero-bg);
  position: relative;
  overflow: hidden;
  cursor: pointer;
  grid-row: 1 / 3;
  display: block;
  text-decoration: none;
}
.scard-lead__img { position: absolute; inset: 0; }
.scard-lead__img :deep(img) {
  width: 100%; height: 100%;
  object-fit: cover;
  opacity: 0.5;
  transition: opacity 0.4s ease, transform 0.65s ease;
}
.scard-lead:hover .scard-lead__img :deep(img) { opacity: 0.35; transform: scale(1.04); }
.scard-lead__body {
  position: relative;
  z-index: 1;
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 460px;
  justify-content: flex-end;
  background: linear-gradient(to top, rgba(12, 12, 10, 0.95) 0%, rgba(12, 12, 10, 0.2) 60%, transparent 100%);
}
.scard-lead__tag {
  font-size: 0.54rem;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 1rem;
}
.scard-lead__title {
  font-family: var(--font-serif);
  font-size: clamp(1.75rem, 2.5vw, 2.5rem);
  font-weight: 300;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #F5F4F0;
  margin-bottom: 1.25rem;
  white-space: pre-line;
}
.scard-lead__excerpt {
  font-size: 0.76rem;
  color: rgba(245, 244, 240, 0.52);
  line-height: 1.8;
  margin-bottom: 1.5rem;
}
.scard-lead__read {
  font-size: 0.58rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent);
  border-bottom: 1px solid rgba(232, 24, 110, 0.35);
  padding-bottom: 2px;
  width: fit-content;
  transition: border-color 0.2s;
}
.scard-lead:hover .scard-lead__read { border-color: var(--accent); }

/* Small cards — light */
.scard {
  background: var(--body-bg);
  border: 1px solid var(--subtle);
  padding: 2rem 2rem 1.75rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: border-color 0.25s;
  text-decoration: none;
  color: inherit;
}
.scard:hover { border-color: var(--accent); }
.scard__img {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  margin: -2rem -2rem 1.5rem;
}
.scard__img :deep(img) {
  width: 100%; height: 100%;
  object-fit: cover; display: block;
  transition: transform 0.6s ease;
}
.scard:hover .scard__img :deep(img) { transform: scale(1.05); }
.scard__tag {
  font-size: 0.52rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 0.65rem;
}
.scard__title {
  font-family: var(--font-serif);
  font-size: clamp(1rem, 1.4vw, 1.3rem);
  font-weight: 400;
  line-height: 1.25;
  letter-spacing: -0.01em;
  flex: 1;
  margin-bottom: 1.25rem;
  transition: color 0.2s;
  white-space: pre-line;
}
.scard:hover .scard__title { color: var(--accent); }
.scard__date {
  font-size: 0.58rem;
  color: var(--muted);
  letter-spacing: 0.1em;
  margin-top: auto;
}

@media (max-width: 900px) {
  .stories__layout { grid-template-columns: 1fr 1fr; }
  .scard-lead { grid-row: auto; grid-column: 1 / -1; }
}
@media (max-width: 600px) {
  .stories__layout { grid-template-columns: 1fr; }
}
</style>
