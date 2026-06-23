<script setup lang="ts">
defineProps<{
  photo: { id: number, r2Key: string, caption: string | null, photographer: string | null }
  isCover?: boolean
}>()
defineEmits<{ setCover: [], edit: [], remove: [] }>()
</script>

<template>
  <div class="group relative aspect-square overflow-hidden rounded-md bg-paper-soft ring-1 ring-line">
    <img :src="`/images/${photo.r2Key}`" :alt="photo.caption || ''" class="size-full object-cover" loading="lazy">

    <span
      v-if="isCover"
      class="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-ink/70 px-1.5 py-0.5 text-[11px] font-medium text-white"
    >
      <Icon name="heroicons:star-solid" class="size-3 text-amber-300" /> ปก
    </span>

    <div class="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-ink/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
      <button type="button" title="ตั้งเป็นรูปปก" class="rounded bg-white/90 p-1.5 text-ink hover:bg-white" @click="$emit('setCover')">
        <Icon name="heroicons:star" class="size-4" />
      </button>
      <button type="button" title="แก้ไข" class="rounded bg-white/90 p-1.5 text-ink hover:bg-white" @click="$emit('edit')">
        <Icon name="heroicons:pencil-square" class="size-4" />
      </button>
      <button type="button" title="ลบ" class="rounded bg-white/90 p-1.5 text-red-600 hover:bg-white" @click="$emit('remove')">
        <Icon name="heroicons:trash" class="size-4" />
      </button>
    </div>
  </div>
</template>
