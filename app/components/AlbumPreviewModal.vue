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
  albumDateEnd?: string
  photoCount: number
  /** The specific photo the user clicked (shown as hero) */
  clickedSrc: string
  /** Real aspect ratio (w/h) of the clicked photo, when the grid knows it */
  clickedRatio?: number
}>()

const emit = defineEmits<{
  close: []
}>()

const { t } = useI18n()
const localePath = useLocalePath()

const albumPath = computed(() => localePath(albumRoutePath(props.albumId)))

const formattedDate = computed(() => {
  if (!props.albumDate) return ''
  return formatAlbumDateRange(props.albumDate, props.albumDateEnd)
})

// ── Orientation-aware layout ──
// Landscape photos keep the stacked card with the hero at (roughly) its real
// ratio. Portrait photos switch to a side-by-side card on wide screens so the
// modal doesn't grow into a scrolling tower, and a 4:5 crop on mobile.
const heroRatio = computed(() => {
  const r = props.clickedRatio
  if (!r || !Number.isFinite(r) || r <= 0) return 1.5
  return Math.min(Math.max(r, 0.7), 1.9)
})
const isPortrait = computed(() => heroRatio.value < 0.95)

const dialogRef = ref<HTMLElement | null>(null)
let lastFocused: HTMLElement | null = null

function handleBackdropClick() {
  emit('close')
}

function focusableEls(): HTMLElement[] {
  if (!dialogRef.value) return []
  return Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter(el => el.offsetParent !== null || el === dialogRef.value)
}

function trapTab(e: KeyboardEvent) {
  const els = focusableEls()
  if (!els.length) {
    e.preventDefault()
    dialogRef.value?.focus()
    return
  }
  const first = els[0]!
  const last = els[els.length - 1]!
  const active = document.activeElement as HTMLElement | null
  if (e.shiftKey && (active === first || active === dialogRef.value)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (!props.open) return
  if (e.key === 'Escape') {
    emit('close')
    return
  }
  if (e.key === 'Tab') trapTab(e)
}

// Focus the dialog on open, lock body scroll, and restore focus on close.
watch(() => props.open, (open) => {
  if (import.meta.server) return
  const root = document.documentElement
  if (open) {
    lastFocused = document.activeElement as HTMLElement | null
    // Compensate for the vanishing scrollbar — otherwise the whole page
    // (photo wall included) reflows sideways right as the enter transition
    // starts, which reads as click lag on Windows.
    // Locking/measuring must target <html>, not <body>: main.css sets an
    // explicit `overflow-x: hidden` on html, which suppresses the usual
    // body-to-viewport overflow propagation — html stays the real scrolling
    // element, so a body-only lock is a no-op and the padding-right
    // compensation over-corrects, shifting content left instead of holding it.
    const scrollbar = window.innerWidth - root.clientWidth
    root.style.overflow = 'hidden'
    if (scrollbar > 0) root.style.paddingRight = `${scrollbar}px`
    nextTick(() => dialogRef.value?.focus())
  } else {
    root.style.overflow = ''
    root.style.paddingRight = ''
    lastFocused?.focus?.()
    lastFocused = null
  }
})

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.documentElement.style.overflow = ''
  document.documentElement.style.paddingRight = ''
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
        <div
          ref="dialogRef"
          class="album-modal__content"
          :class="{ 'album-modal__content--portrait': isPortrait }"
          tabindex="-1"
        >
          <button
            type="button"
            class="album-modal__close"
            :aria-label="t('common.close') || 'Close'"
            @click="emit('close')"
          >
            <span class="album-modal__close-label">{{ t('common.close') }}</span>
            <Icon name="heroicons:x-mark" class="album-modal__close-icon" />
          </button>

          <div class="album-modal__hero" :style="isPortrait ? undefined : { aspectRatio: String(heroRatio) }">
            <!-- eager: the clicked photo is already decoded on the wall, so the
                 default blur-in reveal would only add compositing work while the
                 modal's own enter transition is running. -->
            <AppImg
              :src="clickedSrc"
              :alt="albumTitle"
              sizes="(max-width: 600px) 100vw, 520px"
              class="album-modal__image"
              eager
            />
          </div>

          <div class="album-modal__body">
            <p class="album-modal__kicker">{{ t('common.album') }}</p>
            <h2 class="album-modal__title" :lang="textLang(albumTitle)">{{ albumTitle }}</h2>
            <p class="album-modal__meta">
              <span v-if="formattedDate" class="album-modal__meta-item">{{ formattedDate }}</span>
              <span v-if="formattedDate" class="album-modal__dot" aria-hidden="true">·</span>
              <span class="album-modal__meta-item">{{ t('albums.metaFrames', { count: photoCount }) }}</span>
            </p>

            <NuxtLink :to="albumPath" class="album-modal__cta">
              {{ t('albums.viewFull') }}
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
  /* No backdrop-filter here: blurring the whole animated photo wall while the
     modal's enter transition runs re-blurs every frame and makes the open
     visibly stutter. A slightly deeper plain scrim reads the same. */
  background: rgba(12, 12, 10, 0.88);
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
  top: 1rem;
  right: 1rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2rem;
  padding: 0 0.65rem 0 0.8rem;
  border: 1px solid rgba(245, 244, 240, 0.62);
  background: rgba(12, 12, 10, 0.48);
  color: #F5F4F0;
  font-family: var(--font-sans, sans-serif);
  font-size: 0.52rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  cursor: pointer;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
}
.album-modal__close:hover {
  background: var(--accent, #E8186E);
  border-color: var(--accent, #E8186E);
  color: #F5F4F0;
}
.album-modal__close:focus-visible {
  outline: 2px solid var(--accent, #E8186E);
  outline-offset: 3px;
}
.album-modal__close-label {
  line-height: 1;
}
.album-modal__close-icon {
  width: 0.9rem;
  height: 0.9rem;
  flex-shrink: 0;
}

.album-modal__hero {
  position: relative;
  width: 100%;
  /* Landscape default; the real (clamped) photo ratio comes in as an inline
     style so wide frames aren't force-cropped to 3:2. */
  aspect-ratio: 3 / 2;
  overflow: hidden;
  background: #1a1a18;
}

/* Portrait photos: side-by-side card on wide screens (photo left, body right)
   so the tall frame gets real height without turning the modal into a
   scrolling tower. */
@media (min-width: 601px) {
  .album-modal__content--portrait {
    width: min(100%, 780px);
    display: grid;
    grid-template-columns: minmax(0, 46%) 1fr;
  }
  .album-modal__content--portrait .album-modal__hero {
    height: 100%;
    min-height: 420px;
    aspect-ratio: auto;
  }
  .album-modal__content--portrait .album-modal__body {
    align-self: center;
  }
}
/* Portrait on mobile: keep the bottom sheet, cap the hero to a 4:5 crop. */
@media (max-width: 600px) {
  .album-modal__content--portrait .album-modal__hero {
    aspect-ratio: 4 / 5;
  }
}
/* Soft top-and-bottom scrim: keeps the close button legible over bright
   frames and lets the featured photo blend into the body below. */
.album-modal__hero::after {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(
    to bottom,
    rgba(12, 12, 10, 0.35) 0%,
    rgba(12, 12, 10, 0) 24%,
    rgba(12, 12, 10, 0) 72%,
    rgba(12, 12, 10, 0.55) 100%
  );
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

.album-modal__kicker {
  font-family: var(--font-latin-sans, sans-serif);
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--accent, #e63946);
  margin: 0 0 0.55rem;
}

.album-modal__title {
  font-family: var(--font-serif, serif);
  font-size: clamp(1.5rem, 4.5vw, 1.95rem);
  font-weight: 300;
  line-height: 1.15;
  color: var(--dark, #F5F4F0);
  margin: 0;
}

.album-modal__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
  font-family: var(--font-latin-sans, sans-serif);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--muted, #8a8a84);
  margin: 0.7rem 0 0;
}
.album-modal__dot {
  color: var(--subtle, #55554f);
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
    border: none;
    border-top: 1px solid rgba(245, 244, 240, 0.08);
  }
  .album-modal__close {
    top: 0.85rem;
    right: 0.85rem;
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

/* Reduced motion: fade only, no rise/scale. */
@media (prefers-reduced-motion: reduce) {
  .modal-enter-active .album-modal__content,
  .modal-leave-active .album-modal__content {
    transition: opacity 0.2s ease;
  }
  .modal-enter-from .album-modal__content,
  .modal-leave-to .album-modal__content {
    transform: none;
  }
}
</style>
