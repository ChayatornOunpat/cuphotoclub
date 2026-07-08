<script setup lang="ts">
defineProps<{
  albums: Array<{
    title: string
    category: string
    cover: string
    path: string
  }>
  seed: number
}>()

const { t } = useI18n()
</script>

<template>
  <section id="gallery" class="section-pad gallery">
    <div class="wrap">
      <div class="eyebrow"><span class="num">01</span> {{ t('home.featuredWork') }}</div>
      <div class="gallery__live">
        <ClientOnly>
          <LivePhotoGrid />
          <template #fallback>
            <div class="gallery__fallback" aria-hidden="true" />
          </template>
        </ClientOnly>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  background: var(--body-bg);
}

.gallery__live {
  overflow: hidden;
  background: var(--body-bg);
}

.gallery__fallback {
  min-height: 557px;
  background: var(--paper);
}

@media (max-width: 1100px) {
  .gallery__fallback {
    min-height: 578px;
  }
}

@media (max-width: 700px) {
  .gallery__fallback {
    min-height: 581px;
  }
}

@media (max-width: 460px) {
  .gallery__fallback {
    min-height: 603px;
  }
}
</style>
