<script setup lang="ts">
// `allowLibrary` off means upload-only. Collections use it: their cover belongs
// to that one collection, and picking a shared library image would make the
// object referenced from two places, so replacing or deleting one silently
// pulls the image out of the other.
const props = withDefaults(
  defineProps<{ prefix?: string, aspect?: string, allowLibrary?: boolean }>(),
  { allowLibrary: true }
)
const model = defineModel<string | null>()
const { t } = useI18n()

const uploadedKeys = computed<string[]>({
  get: () => model.value ? [model.value] : [],
  set: value => {
    model.value = value[0] ?? null
  }
})

function onUploaded(keys: string[]) {
  model.value = keys[0] ?? model.value ?? null
}

const pickerOpen = ref(false)
function onPicked(keys: string[]) {
  model.value = keys[0] ?? model.value ?? null
}
</script>

<template>
  <div>
    <div v-if="model" class="relative overflow-hidden rounded-md ring-1 ring-line">
      <img :src="`/images/${model}`" class="w-full object-cover" :class="aspect || 'aspect-[16/9]'" alt="">
      <div class="absolute right-2 top-2 flex gap-1.5">
        <button v-if="props.allowLibrary" type="button" class="rounded bg-white/90 p-1.5 text-ink-soft hover:bg-white hover:text-ink" :title="t('adminPicker.chooseFromLibrary')" @click="pickerOpen = true">
          <Icon name="heroicons:photo" class="size-4" />
        </button>
        <button type="button" class="rounded bg-white/90 p-1.5 text-red-600 hover:bg-white" @click="model = null">
          <Icon name="heroicons:trash" class="size-4" />
        </button>
      </div>
    </div>
    <div v-else class="grid gap-2">
      <AdminR2ImageUploader
        v-model="uploadedKeys"
        :prefix="prefix || 'covers'"
        :multiple="false"
        :max-files="1"
        :dropzone-class="aspect || 'aspect-[16/9]'"
        @uploaded="onUploaded"
      />
      <button v-if="props.allowLibrary" type="button" class="justify-self-start text-xs text-ink-soft underline hover:text-ink" @click="pickerOpen = true">
        {{ t('adminPicker.chooseFromLibrary') }}
      </button>
    </div>

    <AdminImagePickerModal v-if="props.allowLibrary" v-model="pickerOpen" :prefix="prefix || 'covers'" @select="onPicked" />
  </div>
</template>
