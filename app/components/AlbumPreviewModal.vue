<script setup lang="ts">
/**
 * AlbumPreviewModal — shown when a user clicks a photo in the LivePhotoGrid.
 * Displays the album cover, title, date, photo count, and a CTA to view the full album.
 * Uses Teleport to body so it sits above everything.
 */

const props = defineProps<{
  open: boolean
  albumId: string
  albumTitle: string
  albumCover: string
  albumDate: string
  photoCount: number
  /** The specific photo the user clicked (shown as hero) */
  clickedSrc: string
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const albumPath = computed(() => localePath(`/albums/${props.albumId}`))

const formattedDate = computed(() => {
  if (!props.albumDate) return ''
  try {
    const d = new Date(props.albumDate)
    return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'long' })
  } catch {
    return props.albumDate
  }
})

function handleBackdropClick() {
  emit('close')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="album-modal"
        role="dialog"
        aria-modal="true"
        :aria-label="albumTitle"
      >
        <div class="album-modal__backdrop" @click="handleBackdropClick" />
        <div class="album-modal__content">
          <button
            type="button"
            class="album-modal__close"
            :aria-label="t('common.close') || 'Close'"
            @click="emit('close')"
          >
            <Icon name="heroicons:x-mark" class="album-modal__close-icon" />
          </button>

          <div class="album-modal__hero">
            <AppImg
              :src="clickedSrc"
              :alt="albumTitle"
              sizes="(max-width: 600px) 100vw, 520px"
              class="album-modal__image"
            />
          </div>

          <div class="album-modal__body">
            <p v-if="formattedDate" class="album-modal__date">{{ formattedDate }}</p>
            <h2 class="album-modal__title">{{ albumTitle }}</h2>
            <p class="album-modal__count">
              {{ t('albums.metaFrames', { count: photoCount }) }}
            </p>

            <NuxtLink :to="albumPath" class="album-modal__cta">
              {{ t('albums.viewFull') || 'ดูอัลบั้มเต็ม' }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.album-modal {
  position: fixed;
  inset: 0;
  z-index: 500;
  display: grid;
  place-items: center;
  padding: 1rem;
}

.album-modal__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(12, 12, 10, 0.82);
  backdrop-filter: blur(4px);
}

.album-modal__content {
  position: relative;
  width: min(100%, 480px);
  max-height: 90vh;
  overflow-y: auto;
  background: var(--body-bg, #0c0c0a);
  border: 1px solid rgba(245, 244, 240, 0.08);
  box-shadow: 0 2rem 6rem rgba(12, 12, 10, 0.6);
}

.album-modal__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 2;
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border: none;
  background: rgba(12, 12, 10, 0.6);
  color: #F5F4F0;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s ease;
}
.album-modal__close:hover {
  background: rgba(12, 12, 10, 0.9);
}
.album-modal__close-icon {
  width: 1.1rem;
  height: 1.1rem;
}

.album-modal__hero {
  width: 100%;
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: #1a1a18;
}
.album-modal__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.album-modal__body {
  padding: 1.5rem 1.75rem 2rem;
}

.album-modal__date {
  font-family: var(--font-latin-sans, sans-serif);
  font-size: 0.6rem;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--accent, #e63946);
  margin-bottom: 0.5rem;
}

.album-modal__title {
  font-family: var(--font-serif, serif);
  font-size: clamp(1.4rem, 4vw, 1.8rem);
  font-weight: 300;
  line-height: 1.2;
  color: var(--dark, #F5F4F0);
  margin: 0;
}

.album-modal__count {
  font-size: 0.78rem;
  color: var(--muted, #8a8a84);
  margin-top: 0.5rem;
}

.album-modal__cta {
  display: inline-block;
  margin-top: 1.25rem;
  padding: 0.72rem 1.5rem;
  border: 1px solid var(--dark, #F5F4F0);
  background: transparent;
  color: var(--dark, #F5F4F0);
  font-family: var(--font-sans, sans-serif);
  font-size: 0.65rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.album-modal__cta:hover {
  background: var(--accent, #e63946);
  border-color: var(--accent, #e63946);
  color: #fff;
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}
.modal-enter-active .album-modal__content,
.modal-leave-active .album-modal__content {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.25s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .album-modal__content {
  opacity: 0;
  transform: translateY(1.5rem) scale(0.96);
}
.modal-leave-to .album-modal__content {
  opacity: 0;
  transform: translateY(1rem) scale(0.97);
}

/* Mobile: bottom-sheet style */
@media (max-width: 600px) {
  .album-modal {
    align-items: flex-end;
    padding: 0;
  }
  .album-modal__content {
    width: 100%;
    max-height: 85vh;
    border-radius: 1rem 1rem 0 0;
    border: none;
    border-top: 1px solid rgba(245, 244, 240, 0.08);
  }
  .modal-enter-from .album-modal__content {
    transform: translateY(100%);
    opacity: 1;
  }
  .modal-leave-to .album-modal__content {
    transform: translateY(100%);
    opacity: 1;
  }
}
</style>
