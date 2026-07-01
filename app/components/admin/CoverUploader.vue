<script setup lang="ts">
const props = defineProps<{ prefix?: string, aspect?: string }>()
const model = defineModel<string | null>()

const uploadedKeys = computed<string[]>({
  get: () => model.value ? [model.value] : [],
  set: value => {
    model.value = value[0] ?? null
  }
})

function onUploaded(keys: string[]) {
  model.value = keys[0] ?? model.value ?? null
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
    <AdminR2ImageUploader
      v-else
      v-model="uploadedKeys"
      :prefix="prefix || 'covers'"
      :multiple="false"
      :max-files="1"
      :dropzone-class="aspect || 'aspect-[16/9]'"
      @uploaded="onUploaded"
    />
  </div>
</template>
