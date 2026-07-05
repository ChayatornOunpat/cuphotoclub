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
}>()

// R2 blob images are already served by the app's /images route. Render those
// directly so covers do not depend on Nuxt Image's remote-domain allowlist.
const isRoutedImage = computed(() => props.src?.startsWith('/images/'))

const loaded = ref(false)
const imgEl = ref<HTMLImageElement | null>(null)
const isEager = computed(() => props.eager === true)
const done = computed(() => loaded.value || isEager.value)

function markLoaded() {
  loaded.value = true
}

onMounted(() => {
  if (imgEl.value?.complete) markLoaded()
})
</script>

<template>
  <img
    v-if="isRoutedImage"
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
