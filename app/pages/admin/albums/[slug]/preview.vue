<script setup lang="ts">
import AlbumContact from '~/components/AlbumContact.vue'
import AlbumDarkroom from '~/components/AlbumDarkroom.vue'
import AlbumEssay from '~/components/AlbumEssay.vue'
import AlbumSticky from '~/components/AlbumSticky.vue'

definePageMeta({ layout: 'site', middleware: 'admin' })

const route = useRoute()
const slug = route.params.slug as string

const { data: album } = await useFetch(`/api/admin/albums/${slug}`)
if (!album.value) throw createError({ statusCode: 404, statusMessage: 'Album not found', fatal: true })

const styles = { essay: AlbumEssay, sticky: AlbumSticky, contact: AlbumContact, darkroom: AlbumDarkroom }
const styleComponent = computed(() => styles[album.value!.style] ?? AlbumEssay)

useHead({ title: () => `${album.value?.title?.replace(/\n+/g, ' ')} — CU Photo Club` })
</script>

<template>
  <component :is="styleComponent" v-if="album" :album="album" />
</template>
