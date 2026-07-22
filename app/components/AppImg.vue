<script setup lang="ts">
// Site-wide image loading with a progressive blur-to-sharp reveal.
//
//  • default (thumbnails, feed cards, album frames): starts blurred and
//    transparent, then resolves into focus when loaded — a smooth unblur
//    that avoids the jarring placeholder→full swap.
//
//  • eager (top banners / hero / History / About / album covers): loads
//    immediately at high priority. No transition since there's no waiting.
const props = defineProps<{
  src: string
  alt?: string
  sizes?: string
  width?: string | number
  height?: string | number
  eager?: boolean
  // Opt-in to Cloudflare Image Transformations. Only set this on *bounded*
  // surfaces (hero pool, album covers, story/post cards, listings) — never on
  // the ~8k-image album walls or the random flip-grid, or a month of traffic
  // will blow through the 5,000 unique-transformations/month free tier.
  optimize?: boolean
}>()

// R2 blob images are already served by the app's /images route. Render those
// directly so covers do not depend on Nuxt Image's remote-domain allowlist.
const isRoutedImage = computed(() => props.src?.startsWith('/images/'))

// In production, routed images go through Cloudflare Image Transformations
// (/cdn-cgi/image/ via the `cloudflare` Nuxt Image provider) so they get a
// real srcset + auto WebP/AVIF instead of the full-size R2 original. If a
// transform request fails (e.g. transformations not enabled on the zone),
// fall back to serving the original.
const transformFailed = ref(false)
const useTransforms = computed(() =>
  props.optimize === true
  && isRoutedImage.value
  && useRuntimeConfig().public.imageTransforms === true
  && !transformFailed.value
)

// Fires once the underlying <img> has finished loading. Parents (e.g. the hero)
// listen to this to hold a loading screen until the image is on screen.
const emit = defineEmits<{ load: [] }>()

const loaded = ref(false)
const imgEl = ref<HTMLImageElement | null>(null)
// NuxtImg renders a single <img> as its root element, so `$el` is that <img>.
const nuxtImgEl = ref<{ $el?: HTMLImageElement } | null>(null)
const isEager = computed(() => props.eager === true)
const done = computed(() => loaded.value || isEager.value)

function markLoaded() {
  if (loaded.value) return
  loaded.value = true
  emit('load')
}

// If the src changes (e.g. the hero re-rolls to a new random image), reset so
// the new image's load fires `load` again and the blur-in transition replays.
watch(() => props.src, () => {
  loaded.value = false
})

onMounted(() => {
  // Images restored from cache during SSR may already be complete before the
  // @load listener is attached, so the event never fires — check explicitly.
  const el = imgEl.value ?? nuxtImgEl.value?.$el
  if (el?.complete) markLoaded()
})
</script>

<template>
  <NuxtImg
    v-if="useTransforms"
    ref="nuxtImgEl"
    provider="cloudflare"
    format="auto"
    :src="props.src"
    :alt="props.alt ?? ''"
    :sizes="props.sizes"
    :width="props.width"
    :height="props.height"
    :loading="isEager ? 'eager' : 'lazy'"
    :fetchpriority="isEager ? 'high' : 'auto'"
    :preload="isEager ? true : undefined"
    :class="{ 'app-img--done': done }"
    class="app-img"
    @load="markLoaded"
    @error="transformFailed = true"
  />
  <img
    v-else-if="isRoutedImage"
    ref="imgEl"
    :src="props.src"
    :alt="props.alt ?? ''"
    :sizes="props.sizes"
    :width="props.width"
    :height="props.height"
    :loading="isEager ? 'eager' : 'lazy'"
    :fetchpriority="isEager ? 'high' : 'auto'"
    :class="{ 'app-img--done': done }"
    class="app-img"
    @load="markLoaded"
  >
  <NuxtImg
    v-else
    ref="nuxtImgEl"
    :src="props.src"
    :alt="props.alt ?? ''"
    :sizes="props.sizes"
    :width="props.width"
    :height="props.height"
    :loading="isEager ? 'eager' : 'lazy'"
    :fetchpriority="isEager ? 'high' : 'auto'"
    :preload="isEager ? true : undefined"
    :class="{ 'app-img--done': done }"
    @load="markLoaded"
    class="app-img"
  />
</template>

<style scoped>
.app-img {
  opacity: 0;
  filter: blur(14px);
  transform: scale(1.02);
  will-change: opacity, filter, transform;
  transition:
    opacity 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    filter 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94),
    transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.app-img--done {
  opacity: 1;
  filter: blur(0);
  transform: scale(1);
}
</style>
