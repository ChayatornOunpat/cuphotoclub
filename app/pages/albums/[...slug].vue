<script setup lang="ts">
import AlbumEssay from '~/components/AlbumEssay.vue'
import AlbumSticky from '~/components/AlbumSticky.vue'
import AlbumContact from '~/components/AlbumContact.vue'

definePageMeta({ layout: 'site' })

const route = useRoute()
const slug = computed(() => {
  const value = route.params.slug
  return Array.isArray(value) ? value.join('/') : String(value)
})

const { data: album } = await useAsyncData(`album-${route.path}`, async () => {
  return await $fetch(`/api/albums/${slug.value}`).catch(() => null)
})

if (!album.value) {
  throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })
}

// The admin's chosen style maps to a render component (set-and-forget). Explicit
// imports (not a string name) so the components are bundled and resolve for <component :is>.
const styles = { essay: AlbumEssay, sticky: AlbumSticky, contact: AlbumContact }
const styleComponent = computed(() => styles[album.value!.style] ?? AlbumEssay)

useHead({ title: () => `${album.value?.title?.replace(/\n+/g, ' ')} — CU Photo Club` })
</script>

<template>
  <component :is="styleComponent" v-if="album" :album="album" />
</template>
