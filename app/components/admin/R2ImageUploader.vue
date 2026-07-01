<script setup lang="ts">
const props = withDefaults(defineProps<{
  prefix?: string
  multiple?: boolean
  maxFiles?: number
  dropzoneClass?: string
  showPreviews?: boolean
}>(), {
  prefix: 'uploads',
  multiple: true,
  maxFiles: 0,
  dropzoneClass: '',
  showPreviews: true
})

const model = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{
  uploaded: [keys: string[]]
}>()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const dragOver = ref(false)
const total = ref(0)
const done = ref(0)
const errorCount = ref(0)

const COMPRESS_MAX_DIM = 3040
const COMPRESS_QUALITY = 0.90
const COMPRESS_MIN_BYTES = 200_000

const autoCompress = ref(true)

async function compressImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  let w = bmp.width, h = bmp.height
  if (w > COMPRESS_MAX_DIM || h > COMPRESS_MAX_DIM) {
    if (w >= h) { h = Math.round(h * COMPRESS_MAX_DIM / w); w = COMPRESS_MAX_DIM }
    else        { w = Math.round(w * COMPRESS_MAX_DIM / h); h = COMPRESS_MAX_DIM }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const compressed = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/jpeg', COMPRESS_QUALITY)
  )
  // Never ship a result larger than the original
  const final = compressed.size < file.size ? compressed : file
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([final], name, { type: 'image/jpeg' })
}

const canAddMore = computed(() => !props.maxFiles || model.value.length < props.maxFiles)

function chooseFiles() {
  if (!uploading.value && canAddMore.value) fileInput.value?.click()
}

async function upload(files: File[]) {
  const slotsLeft = props.maxFiles ? Math.max(props.maxFiles - model.value.length, 0) : files.length
  const images = files
    .filter(file => file.type.startsWith('image/'))
    .slice(0, props.multiple ? slotsLeft : 1)

  if (!images.length) return

  uploading.value = true
  errorCount.value = 0
  total.value = images.length
  done.value = 0

  const uploadedKeys: string[] = []
  for (const file of images) {
    const toUpload = autoCompress.value && file.size > COMPRESS_MIN_BYTES ? await compressImage(file) : file
    const fd = new FormData()
    fd.append('file', toUpload)
    fd.append('prefix', props.prefix)

    try {
      const { key } = await $fetch<{ key: string }>('/api/admin/upload', {
        method: 'POST',
        body: fd
      })
      uploadedKeys.push(key)
    } catch {
      errorCount.value++
    } finally {
      done.value++
    }
  }

  if (uploadedKeys.length) {
    model.value = props.multiple ? [...model.value, ...uploadedKeys] : uploadedKeys.slice(0, 1)
    emit('uploaded', uploadedKeys)
  }

  uploading.value = false
  if (fileInput.value) fileInput.value.value = ''
}

function removeKey(key: string) {
  model.value = model.value.filter(item => item !== key)
}

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files?.length) upload(Array.from(input.files))
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (!canAddMore.value || !e.dataTransfer?.files?.length) return
  upload(Array.from(e.dataTransfer.files))
}
</script>

<template>
  <div class="r2up">
    <!-- Dropzone -->
    <div
      class="r2up__zone"
      :class="[
        dragOver ? 'is-drag-over' : '',
        !canAddMore ? 'is-full' : '',
        dropzoneClass
      ]"
      @dragover.prevent="dragOver = canAddMore"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div v-if="uploading" class="r2up__uploading">
        <UiSpinner />
        <span class="r2up__progress">{{ done }}&thinsp;/&thinsp;{{ total }}</span>
      </div>
      <template v-else-if="canAddMore">
        <svg class="r2up__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="0" />
          <polyline points="3 15 8 10 12 14 16 10 21 15" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        <p class="r2up__label">
          Drag photos here or
          <button type="button" class="r2up__pick" @click="chooseFiles">browse</button>
        </p>
        <p class="r2up__hint">JPG · PNG · WebP · HEIC — up to 50 MB per file</p>
      </template>
      <p v-else class="r2up__full">Upload limit reached</p>

      <input ref="fileInput" type="file" accept="image/*" :multiple="multiple" class="r2up__input" @change="onPick">
    </div>

    <!-- Compress toggle -->
    <div class="r2up__compress">
      <span class="r2up__compress-label">Auto-compress</span>
      <div class="r2up__compress-toggle">
        <button type="button" class="r2up__compress-btn" :class="{ active: autoCompress }" @click="autoCompress = true">On</button>
        <button type="button" class="r2up__compress-btn" :class="{ active: !autoCompress }" @click="autoCompress = false">Off</button>
      </div>
      <span class="r2up__compress-detail">
        {{ autoCompress ? `Originals never stored · resized to ${COMPRESS_MAX_DIM}px · JPEG ${Math.round(COMPRESS_QUALITY * 100)}%` : 'Original file uploaded as-is — no compression' }}
      </span>
    </div>

    <!-- Status -->
    <p v-if="!uploading && errorCount" class="r2up__error">{{ errorCount }} file{{ errorCount === 1 ? '' : 's' }} failed to upload</p>

    <!-- Previews -->
    <div v-if="showPreviews && model.length" class="r2up__previews">
      <div v-for="key in model" :key="key" class="r2up__thumb">
        <img :src="`/images/${key}`" alt="" loading="lazy">
        <button type="button" class="r2up__remove" title="ลบ" @click="removeKey(key)">
          <Icon name="heroicons:trash" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.r2up { display: flex; flex-direction: column; gap: 0.75rem; }

/* ── Dropzone ── */
.r2up__zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.4rem 1.5rem;
  border: 1px dashed var(--subtle);
  background: color-mix(in srgb, var(--body-bg) 60%, white);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.18s, background 0.18s;
  min-height: 9rem;
}
.r2up__zone:hover,
.r2up__zone.is-drag-over {
  border-color: var(--accent);
  border-style: solid;
  background: color-mix(in srgb, var(--accent) 4%, white);
}
.r2up__zone.is-full {
  opacity: 0.6;
  cursor: default;
}

/* Icon */
.r2up__icon {
  width: 2rem;
  height: 2rem;
  color: var(--muted);
  flex-shrink: 0;
  transition: color 0.18s;
}
.r2up__zone.is-drag-over .r2up__icon { color: var(--accent); }

/* Label */
.r2up__label {
  font-family: var(--font-sans);
  font-size: 0.72rem;
  color: var(--muted);
  line-height: 1.5;
}
.r2up__pick {
  background: none;
  border: none;
  padding: 0;
  font-family: inherit;
  font-size: inherit;
  font-weight: 500;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.r2up__pick:hover { opacity: 0.75; }

/* Hint */
.r2up__hint {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  opacity: 0.65;
  text-transform: uppercase;
}

/* Uploading state */
.r2up__uploading {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}
.r2up__progress {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: var(--muted);
}

/* Full state */
.r2up__full {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  color: var(--muted);
  text-transform: uppercase;
}

/* Compress toggle */
.r2up__compress {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}
.r2up__compress-label {
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--dark);
  flex-shrink: 0;
}
.r2up__compress-toggle { display: flex; flex-shrink: 0; }
.r2up__compress-btn {
  padding: 0.32rem 0.65rem;
  border: 1px solid var(--subtle);
  background: none;
  font-family: var(--font-sans);
  font-size: 0.46rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--dark);
  cursor: pointer;
  margin-left: -1px;
  transition: background 0.13s, color 0.13s, border-color 0.13s;
}
.r2up__compress-btn.active {
  background: var(--dark);
  color: #F5F4F0;
  border-color: var(--dark);
  z-index: 1;
  position: relative;
}
.r2up__compress-detail {
  font-family: var(--font-sans);
  font-size: 0.54rem;
  letter-spacing: 0.03em;
  color: var(--muted);
}

/* Error */
.r2up__error {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  color: #b0243c;
}

/* Hidden input */
.r2up__input { display: none; }

/* ── Previews ── */
.r2up__previews {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.4rem;
}
.r2up__thumb {
  position: relative;
  aspect-ratio: 1;
  overflow: hidden;
  border: 1px solid var(--subtle);
  background: var(--paper);
}
.r2up__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.r2up__remove {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.4rem;
  height: 1.4rem;
  background: rgba(245, 244, 240, 0.9);
  border: none;
  color: #b0243c;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 0.75rem;
}
.r2up__thumb:hover .r2up__remove { opacity: 1; }
</style>
