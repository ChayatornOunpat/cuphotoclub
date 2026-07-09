<script setup lang="ts">
const { t } = useI18n()
const props = defineProps<{ albumId: number }>()
const emit = defineEmits<{ uploaded: [] }>()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const total = ref(0)
const done = ref(0)
const errorCount = ref(0)
const dragOver = ref(false)

async function readDims(file: File): Promise<{ w: number, h: number } | null> {
  try {
    const bmp = await createImageBitmap(file)
    const dims = { w: bmp.width, h: bmp.height }
    bmp.close?.()
    return dims
  } catch {
    return null
  }
}

async function upload(files: File[]) {
  if (uploading.value) return
  const images = files.filter(f => f.type.startsWith('image/'))
  if (!images.length) return
  uploading.value = true
  errorCount.value = 0
  total.value = images.length
  done.value = 0
  for (const file of images) {
    const dims = await readDims(file)
    const fd = new FormData()
    fd.append('file', file)
    if (dims) {
      fd.append('width', String(dims.w))
      fd.append('height', String(dims.h))
    }
    try {
      await $fetch(`/api/admin/galleries/${props.albumId}/photos`, { method: 'POST', body: fd })
    } catch {
      errorCount.value++
    }
    done.value++
  }
  uploading.value = false
  if (fileInput.value) fileInput.value.value = ''
  emit('uploaded')
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) upload(Array.from(input.files))
}
function onDragOver() {
  dragOver.value = !uploading.value
}
function onDrop(e: DragEvent) {
  dragOver.value = false
  if (uploading.value) return
  if (e.dataTransfer?.files?.length) upload(Array.from(e.dataTransfer.files))
}
</script>

<template>
  <div>
    <div
      class="flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors"
      :class="dragOver ? 'border-accent bg-accent-soft/40' : 'border-line bg-paper-soft'"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <Icon name="heroicons:photo" class="size-9 text-ink-soft" />
      <p class="mt-3 text-sm text-ink-soft">
        {{ t('uploader.dragHere') }}
        <button type="button" class="font-semibold text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50" :disabled="uploading" @click="fileInput?.click()">{{ t('uploader.browse') }}</button>
      </p>
      <p class="mt-1 text-xs text-ink-soft/70">{{ t('uploader.hint15') }}</p>
      <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onPick">
    </div>

    <div v-if="uploading || errorCount" class="mt-3 text-sm">
      <p v-if="uploading" class="flex items-center gap-2 text-ink-soft">
        <UiSpinner /> {{ t('uploader.uploading', { done, total }) }}
      </p>
      <p v-else-if="errorCount" class="text-red-600">{{ t('uploader.failed', errorCount, { n: errorCount }) }}</p>
    </div>
  </div>
</template>
