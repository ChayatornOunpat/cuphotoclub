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
      <div class="cover-actions">
        <button v-if="props.allowLibrary" type="button" class="cover-actions__btn" :title="t('adminPicker.chooseFromLibrary')" @click="pickerOpen = true">
          <Icon name="heroicons:photo" />
        </button>
        <button type="button" class="cover-actions__btn cover-actions__btn--danger" :title="t('admin.delete')" @click="model = null">
          <Icon name="heroicons:trash" />
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

<style scoped>
/* Only this action-button group is scoped CSS — the rest of the component
   still uses Tailwind. Not a full migration, just not adding more of it to
   the one piece actually being restyled here. */
.cover-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.35rem;
}
.cover-actions__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.7rem;
  height: 1.7rem;
  border: 1px solid var(--subtle);
  background: rgba(255, 255, 255, 0.92);
  color: var(--muted);
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}
.cover-actions__btn:hover { border-color: var(--dark); color: var(--dark); background: #fff; }
.cover-actions__btn--danger { color: var(--accent); }
.cover-actions__btn--danger:hover { border-color: var(--accent); background: #fff; }
.cover-actions__btn :deep(svg) { width: 0.85rem; height: 0.85rem; }
</style>
