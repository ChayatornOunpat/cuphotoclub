<script setup lang="ts">
const props = defineProps<{ prefix?: string, aspect?: string }>()
const model = defineModel<string | null>()

const input = ref<HTMLInputElement>()
const uploading = ref(false)

async function onPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('prefix', props.prefix || 'covers')
    const { key } = await $fetch<{ key: string }>('/api/admin/upload', { method: 'POST', body: fd })
    model.value = key
  } catch (e) {
    alert((e as { data?: { message?: string } })?.data?.message || 'อัปโหลดไม่สำเร็จ')
  } finally {
    uploading.value = false
    if (input.value) input.value.value = ''
  }
}
</script>

<template>
  <div>
    <div v-if="model" class="relative overflow-hidden rounded-md ring-1 ring-line">
      <img :src="`/images/${model}`" class="w-full object-cover" :class="aspect || 'aspect-[16/9]'" alt="">
      <button type="button" class="absolute right-2 top-2 rounded bg-white/90 p-1.5 text-red-600 hover:bg-white" @click="model = null">
        <Icon name="heroicons:trash" class="size-4" />
      </button>
    </div>
    <button
      v-else
      type="button"
      class="flex w-full flex-col items-center justify-center rounded-md border-2 border-dashed border-line bg-paper-soft text-ink-soft hover:border-accent disabled:opacity-50"
      :class="aspect || 'aspect-[16/9]'"
      :disabled="uploading"
      @click="input?.click()"
    >
      <UiSpinner v-if="uploading" />
      <template v-else>
        <Icon name="heroicons:photo" class="size-8" />
        <span class="mt-2 text-sm">อัปโหลดรูปปก</span>
      </template>
    </button>
    <input ref="input" type="file" accept="image/*" class="hidden" @change="onPick">
  </div>
</template>
