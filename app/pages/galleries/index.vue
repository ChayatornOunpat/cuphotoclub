<script setup lang="ts">
interface AlbumRow {
  id: number
  slug: string
  title: string
  eventDate: string | null
  photoCount: number
  coverKey: string | null
}

const { data: albums } = await useFetch<AlbumRow[]>('/api/albums')

useSeoMeta({
  title: 'แกลเลอรี',
  description: 'ภาพถ่ายกิจกรรมและผลงานจากชมรมถ่ายภาพ'
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-12 sm:py-16">
    <header class="max-w-2xl">
      <h1 class="text-3xl font-bold tracking-tight text-ink">แกลเลอรี</h1>
      <p class="mt-3 text-ink-soft">รวมภาพถ่ายจากกิจกรรมต่าง ๆ ของชมรม</p>
    </header>

    <div v-if="albums && albums.length" class="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
      <PublicAlbumCard v-for="album in albums" :key="album.id" :album="album" />
    </div>

    <div v-else class="mt-16 text-center text-ink-soft">
      <Icon name="heroicons:photo" class="mx-auto size-12 text-ink-soft/30" />
      <p class="mt-4">ยังไม่มีอัลบั้มที่เผยแพร่</p>
    </div>
  </div>
</template>
