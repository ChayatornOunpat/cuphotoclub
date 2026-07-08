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
const infoOpen = ref(false)
const infoRef = ref<HTMLElement | null>(null)

function closeInfo() {
  infoOpen.value = false
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!infoOpen.value) return
  const target = event.target
  if (!(target instanceof Node)) return
  if (infoRef.value?.contains(target)) return
  closeInfo()
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeInfo()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown)
  document.addEventListener('keydown', onDocumentKeyDown)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown)
  document.removeEventListener('keydown', onDocumentKeyDown)
})
</script>

<template>
  <section id="gallery" class="section-pad gallery">
    <div class="wrap">
      <div class="gallery__heading">
        <div class="eyebrow">
          <span class="num">01</span>
          <span>{{ t('home.featuredWork') }}</span>
        </div>
      </div>
      <div class="gallery__live">
        <ClientOnly>
          <LivePhotoGrid />
          <template #fallback>
            <div class="gallery__fallback" aria-hidden="true" />
          </template>
        </ClientOnly>
      </div>
      <div ref="infoRef" class="gallery__help">
        <button
          type="button"
          class="gallery__help-button"
          :aria-expanded="infoOpen"
          aria-controls="featured-work-note"
          @click="infoOpen = !infoOpen"
        >
          {{ t('home.featuredWorkInfoButton') }}
        </button>
        <span v-if="infoOpen" id="featured-work-note" class="gallery__note" role="tooltip">
          {{ t('home.featuredWorkInfoBody') }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.gallery {
  background: var(--body-bg);
}

.gallery__heading {
  position: relative;
  z-index: 5;
}

.gallery__help {
  position: relative;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 0.8rem;
}

.gallery__help-button {
  display: inline-flex;
  align-items: center;
  border: 0;
  border-bottom: 1px solid var(--subtle);
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  font-family: var(--font-sans);
  font-size: 0.56rem;
  font-weight: 400;
  letter-spacing: 0.18em;
  line-height: 1.2;
  padding: 0 0 0.22rem;
  text-transform: uppercase;
  transition: border-color 0.2s ease, color 0.2s ease;
}

.gallery__help-button:hover,
.gallery__help-button:focus-visible,
.gallery__help-button[aria-expanded='true'] {
  border-color: var(--accent);
  color: var(--accent);
}

.gallery__help-button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

.gallery__note {
  position: absolute;
  top: calc(100% + 0.65rem);
  right: 0;
  z-index: 10;
  width: min(30rem, calc(100vw - 6rem));
  max-width: 30rem;
  margin: 0;
  background: var(--body-bg);
  border-top: 1px solid var(--accent);
  box-shadow: 0 1rem 2.4rem rgba(12, 12, 10, 0.14);
  padding: 0.85rem 0 0.95rem 1rem;
  color: var(--muted);
  font-family: var(--font-sans);
  font-size: 0.76rem;
  font-weight: 300;
  letter-spacing: 0;
  line-height: 1.7;
  text-transform: none;
  white-space: normal;
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
  .gallery__help {
    justify-content: flex-start;
  }

  .gallery__note {
    right: auto;
    left: 0;
    width: min(100%, calc(100vw - 3rem));
    padding-left: 0;
    padding-right: 1rem;
  }

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
