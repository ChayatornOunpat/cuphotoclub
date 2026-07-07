<script setup lang="ts">
const { t } = useI18n()
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
const skippedCount = ref(0)
const duplicateCount = ref(0)
const resourcePauseSeconds = ref(0)
const resourceLimitStopped = ref(false)
const pendingQueue = ref<File[]>([])
const failedUploads = ref<Array<{ file: File, name: string, reason: string }>>([])
const completedSignatures = new Set<string>()

const COMPRESS_MAX_DIM = 3040
const COMPRESS_QUALITY = 0.90
const COMPRESS_MIN_BYTES = 200_000
const UPLOAD_CONCURRENCY = 2
const UPLOAD_BATCH_DELAY_MS = 1_000
const UPLOAD_SESSION_SIZE = 250
const RESOURCE_LIMIT_PAUSE_MS = 30_000

const autoCompress = ref(true)
let resourcePausePromise: Promise<void> | null = null
let resourcePauseTimer: ReturnType<typeof setInterval> | null = null
let shouldStopCurrentUpload = false

interface UploadManifestItem {
  file: File
  toUpload: File
  hash: string
  key: string
  exists: boolean
  sessionId?: string
  itemId?: string
  status?: string
}

// Queue-order stamp sent with each upload. R2's uploadedAt records *completion*
// time, which scrambles under parallel uploads — this seq is taken when a worker
// pulls the file off the queue, so it preserves the order files were queued in.
// Epoch-ms based so it sorts on the same axis as uploadedAt for legacy images.
let lastSeq = 0
function nextSeq() {
  lastSeq = Math.max(Date.now(), lastSeq + 1)
  return lastSeq
}

function fileSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function prepareId(file: File) {
  return fileSignature(file)
}

function signatureStorageKey() {
  return `cu-r2-uploaded-signatures:${props.prefix}`
}

function loadCompletedSignatures() {
  if (!import.meta.client) return
  try {
    const saved = JSON.parse(sessionStorage.getItem(signatureStorageKey()) || '[]')
    if (Array.isArray(saved)) {
      for (const signature of saved) {
        if (typeof signature === 'string') completedSignatures.add(signature)
      }
    }
  } catch {
    sessionStorage.removeItem(signatureStorageKey())
  }
}

function rememberCompletedSignature(signature: string) {
  completedSignatures.add(signature)
  if (!import.meta.client) return
  try {
    const saved = [...completedSignatures].slice(-2_000)
    sessionStorage.setItem(signatureStorageKey(), JSON.stringify(saved))
  } catch {
    // Ignore storage quota/private-mode failures; server-side hash checks still apply.
  }
}

async function contentHash(file: File) {
  const buffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function fileExt(file: File) {
  return file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
}

function rawUploadError(err: any) {
  const data = err?.data ?? err?.response?._data
  return typeof data === 'string'
    ? data
    : data?.message || data?.statusMessage || err?.message || err?.statusMessage || ''
}

function isWorkerResourceLimitError(err: any) {
  const raw = rawUploadError(err)
  return /Worker exceeded resource limits|Error 1102|exceeded resource limits/i.test(raw)
    || (err?.statusCode >= 500 && /cloudflare|worker|fetch|network|response/i.test(raw || err?.name || ''))
}

function uploadErrorMessage(err: any) {
  const raw = rawUploadError(err)

  if (isWorkerResourceLimitError(err)) {
    return 'Cloudflare Worker exceeded resource limits. Upload stopped; retry failed files after the cooldown.'
  }
  if (/Failed to fetch|fetch failed|NetworkError/i.test(raw)) {
    return 'Network request failed. If this was a direct R2 upload, check the bucket CORS settings and retry this file.'
  }
  if (err?.statusCode === 413 || /too large|ใหญ่เกิน/i.test(raw)) {
    return 'File is too large after compression.'
  }
  return raw ? String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) : 'Upload failed without a server message.'
}

function beginResourceLimitPause() {
  if (resourcePausePromise) return resourcePausePromise

  const pauseUntil = Date.now() + RESOURCE_LIMIT_PAUSE_MS
  resourcePauseSeconds.value = Math.ceil(RESOURCE_LIMIT_PAUSE_MS / 1000)
  resourcePauseTimer = setInterval(() => {
    resourcePauseSeconds.value = Math.max(0, Math.ceil((pauseUntil - Date.now()) / 1000))
  }, 250)

  resourcePausePromise = new Promise((resolve) => {
    setTimeout(() => {
      if (resourcePauseTimer) clearInterval(resourcePauseTimer)
      resourcePauseTimer = null
      resourcePauseSeconds.value = 0
      resourcePausePromise = null
      resolve()
    }, RESOURCE_LIMIT_PAUSE_MS)
  })

  return resourcePausePromise
}

async function waitForResourceLimitPause() {
  if (resourcePausePromise) await resourcePausePromise
}

function wait(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function uniqueUncompleted(files: File[]) {
  const seen = new Set<string>()
  const out: File[] = []
  for (const file of files) {
    const signature = fileSignature(file)
    if (seen.has(signature) || completedSignatures.has(signature)) {
      duplicateCount.value++
      continue
    }
    seen.add(signature)
    out.push(file)
  }
  return out
}

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

const progressPercent = computed(() =>
  total.value ? Math.min(100, Math.round((done.value / total.value) * 100)) : 0
)

// Warn before closing/refreshing the tab while an upload is in flight.
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!uploading.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => {
  loadCompletedSignatures()
  window.addEventListener('beforeunload', onBeforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (resourcePauseTimer) clearInterval(resourcePauseTimer)
})

function chooseFiles() {
  if (!uploading.value && canAddMore.value) fileInput.value?.click()
}

async function uploadOne(file: File, uploadedKeys: string[], uploadedKeySet: Set<string>) {
  const signature = fileSignature(file)
  const seq = nextSeq()
  let stoppedByResourceLimit = false
  try {
    const toUpload = autoCompress.value && file.size > COMPRESS_MIN_BYTES ? await compressImage(file) : file
    const hash = await contentHash(toUpload)
    const stopped = await uploadPreparedFile({ file, toUpload, hash, key: '', exists: false }, uploadedKeys, uploadedKeySet, seq)
    stoppedByResourceLimit = stopped
  } catch (err) {
    errorCount.value++
    if (isWorkerResourceLimitError(err)) {
      shouldStopCurrentUpload = true
      resourceLimitStopped.value = true
      stoppedByResourceLimit = true
      beginResourceLimitPause()
    }
    failedUploads.value.push({
      file,
      name: file.name,
      reason: uploadErrorMessage(err)
    })
    done.value++
  }
  return stoppedByResourceLimit
}

async function createUploadSessionBatch(files: File[]) {
  const prepared = await Promise.all(files.map(async (file) => {
    const toUpload = autoCompress.value && file.size > COMPRESS_MIN_BYTES ? await compressImage(file) : file
    return {
      file,
      toUpload,
      hash: await contentHash(toUpload),
      key: '',
      exists: false
    }
  }))

  const session = await $fetch<{
    id: string
    items: Array<{ id: string, key: string, status: string }>
  }>('/api/admin/upload/sessions', {
    method: 'POST',
    body: {
      prefix: props.prefix,
      files: prepared.map(item => ({
        id: prepareId(item.file),
        name: item.file.name,
        hash: item.hash,
        ext: fileExt(item.toUpload),
        size: item.toUpload.size,
        type: item.toUpload.type || 'image/jpeg'
      }))
    }
  })

  const manifest = new Map(session.items.map(item => [item.id, item]))
  return prepared.map((item) => {
    const match = manifest.get(prepareId(item.file))
    return {
      ...item,
      key: match?.key || '',
      exists: match?.status === 'exists' || match?.status === 'uploaded',
      sessionId: session.id,
      itemId: prepareId(item.file),
      status: match?.status
    }
  })
}

async function uploadPreparedFile(
  item: UploadManifestItem,
  uploadedKeys: string[],
  uploadedKeySet: Set<string>,
  seq = nextSeq()
) {
  const signature = fileSignature(item.file)
  let stoppedByResourceLimit = false
  try {
    if (item.exists && item.key) {
      duplicateCount.value++
      if (!model.value.includes(item.key) && !uploadedKeySet.has(item.key)) {
        uploadedKeySet.add(item.key)
        uploadedKeys.push(item.key)
      }
      rememberCompletedSignature(signature)
      return false
    }

    if (item.sessionId && item.itemId) {
      const { key } = await uploadPreparedFileDirect(item, seq)
      if (!model.value.includes(key) && !uploadedKeySet.has(key)) {
        uploadedKeySet.add(key)
        uploadedKeys.push(key)
      }
      rememberCompletedSignature(signature)
      return false
    }

    const fd = new FormData()
    fd.append('file', item.toUpload)
    fd.append('prefix', props.prefix)
    fd.append('hash', item.hash)
    fd.append('seq', String(seq))

    const { key } = await $fetch<{ key: string }>('/api/admin/upload', {
      method: 'POST',
      body: fd
    })
    if (!model.value.includes(key) && !uploadedKeySet.has(key)) {
      uploadedKeySet.add(key)
      uploadedKeys.push(key)
    }
    rememberCompletedSignature(signature)
  } catch (err) {
    errorCount.value++
    if (isWorkerResourceLimitError(err)) {
      shouldStopCurrentUpload = true
      resourceLimitStopped.value = true
      stoppedByResourceLimit = true
      beginResourceLimitPause()
    }
    failedUploads.value.push({
      file: item.file,
      name: item.file.name,
      reason: uploadErrorMessage(err)
    })
  } finally {
    done.value++
  }
  return stoppedByResourceLimit
}

async function uploadPreparedFileDirect(item: UploadManifestItem, seq: number) {
  if (!item.sessionId || !item.itemId) throw new Error('Upload manifest item is missing session identity.')

  const base = `/api/admin/upload/sessions/${encodeURIComponent(item.sessionId)}/items/${encodeURIComponent(item.itemId)}`
  const presigned = await $fetch<{
    key: string
    status: string
    duplicate?: boolean
    upload?: { url: string, headers: Record<string, string>, expiresAt: string }
  }>(`${base}/presign`, {
    method: 'POST',
    body: { seq }
  })

  if (presigned.duplicate || presigned.status === 'exists' || presigned.status === 'uploaded') {
    duplicateCount.value++
    return { key: presigned.key }
  }
  if (!presigned.upload) {
    throw new Error('Direct R2 upload did not return an upload URL.')
  }

  const response = await fetch(presigned.upload.url, {
    method: 'PUT',
    headers: presigned.upload.headers,
    body: item.toUpload
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Direct R2 upload failed (${response.status}). ${body}`.trim())
  }

  return await $fetch<{ key: string }>(`${base}/complete`, { method: 'POST' })
}

function markUploadStopped(files: File[]) {
  if (!files.length) return
  const reason = 'Not attempted because Cloudflare Worker limits were hit. Retry failed files after the cooldown.'
  for (const file of files) {
    errorCount.value++
    done.value++
    failedUploads.value.push({ file, name: file.name, reason })
  }
}

async function uploadMany(files: File[], uploadedKeys: string[], uploadedKeySet: Set<string>) {
  for (let sessionStart = 0; sessionStart < files.length; sessionStart += UPLOAD_SESSION_SIZE) {
    if (shouldStopCurrentUpload) {
      markUploadStopped(files.slice(sessionStart))
      break
    }

    await waitForResourceLimitPause()
    if (shouldStopCurrentUpload) {
      markUploadStopped(files.slice(sessionStart))
      break
    }

    const sessionFiles = files.slice(sessionStart, sessionStart + UPLOAD_SESSION_SIZE)
    let preparedSession: Awaited<ReturnType<typeof createUploadSessionBatch>>
    try {
      preparedSession = await createUploadSessionBatch(sessionFiles)
    } catch (err) {
      for (let index = 0; index < sessionFiles.length; index += UPLOAD_CONCURRENCY) {
        const batch = sessionFiles.slice(index, index + UPLOAD_CONCURRENCY)
        const stopped = await Promise.all(batch.map(file => uploadOne(file, uploadedKeys, uploadedKeySet)))
        if (shouldStopCurrentUpload || stopped.some(Boolean)) {
          markUploadStopped([...sessionFiles.slice(index + UPLOAD_CONCURRENCY), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
          return
        }
        if (index + UPLOAD_CONCURRENCY < sessionFiles.length || sessionStart + UPLOAD_SESSION_SIZE < files.length) {
          await wait(UPLOAD_BATCH_DELAY_MS)
        }
      }
      continue
    }

    for (let index = 0; index < preparedSession.length; index += UPLOAD_CONCURRENCY) {
      if (shouldStopCurrentUpload) {
        markUploadStopped([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
      await waitForResourceLimitPause()
      if (shouldStopCurrentUpload) {
        markUploadStopped([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }

      const batch = preparedSession.slice(index, index + UPLOAD_CONCURRENCY)
      const stopped = await Promise.all(batch.map(item => uploadPreparedFile(item, uploadedKeys, uploadedKeySet)))
      if (shouldStopCurrentUpload || stopped.some(Boolean)) {
        markUploadStopped([...preparedSession.slice(index + UPLOAD_CONCURRENCY).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
      if (index + UPLOAD_CONCURRENCY < preparedSession.length || sessionStart + UPLOAD_SESSION_SIZE < files.length) {
        await wait(UPLOAD_BATCH_DELAY_MS)
      }
    }
  }
}

async function upload(files: File[], retry = false) {
  duplicateCount.value = 0
  const images = uniqueUncompleted(files.filter(file => file.type.startsWith('image/')))
  if (!images.length) return

  // While an upload is already running, queue and update the counter. The drain
  // loop below counts only what it pulls off the queue, so this is the single
  // place queued files enter `total` (no double count). Single-file mode never
  // drains the queue, so concurrent drops are ignored rather than stranded.
  if (uploading.value) {
    if (props.multiple) {
      pendingQueue.value.push(...images)
      total.value += images.length
    }
    return
  }

  uploading.value = true
  shouldStopCurrentUpload = false
  resourceLimitStopped.value = false
  errorCount.value = 0
  skippedCount.value = 0
  if (!retry) failedUploads.value = []
  total.value = images.length

  let batch = images
  const allUploadedKeys: string[] = []
  const uploadedKeySet = new Set<string>()

  while (batch.length) {
    // model isn't updated until after the loop, so count this run's uploads too.
    const used = model.value.length + allUploadedKeys.length
    const slotsLeft = props.maxFiles ? Math.max(props.maxFiles - used, 0) : batch.length
    const toProcess = batch.slice(0, props.multiple ? slotsLeft : 1)

    if (!toProcess.length) break

    batch = batch.slice(toProcess.length)

    await uploadMany(toProcess, allUploadedKeys, uploadedKeySet)

    if (shouldStopCurrentUpload) break
    if (!props.multiple) break

    // Drain anything queued while this batch was running
    if (!batch.length) batch = pendingQueue.value.splice(0)
  }

  // Whatever is left (limit reached, or extra files in single mode) was not
  // uploaded — say so instead of dropping it silently.
  const skipped = batch.length + pendingQueue.value.length
  if (skipped) {
    skippedCount.value = skipped
    pendingQueue.value = []
  }

  if (allUploadedKeys.length) {
    model.value = props.multiple ? [...new Set([...model.value, ...allUploadedKeys])] : allUploadedKeys.slice(0, 1)
    emit('uploaded', allUploadedKeys)
  }

  uploading.value = false
  total.value = 0
  done.value = 0
  if (fileInput.value) fileInput.value.value = ''
}

function retryFailed() {
  if (uploading.value || !failedUploads.value.length) return
  const files = failedUploads.value.map(item => item.file)
  failedUploads.value = []
  upload(files, true)
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
        <div class="r2up__uploading-mark" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p class="r2up__uploading-kicker">{{ t('uploader.uploadingKicker') }}</p>
        <p class="r2up__uploading-count">
          <strong>{{ done }}</strong>
          <span class="r2up__uploading-sep">/</span>
          {{ total }}
        </p>
        <div class="r2up__uploading-meter" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ transform: `scaleX(${progressPercent / 100})` }" />
        </div>
        <p v-if="resourcePauseSeconds" class="r2up__uploading-pause">
          {{ t('uploader.resourcePause', { seconds: resourcePauseSeconds }) }}
        </p>
        <p class="r2up__uploading-stay">{{ t('uploader.stayOnPage') }}</p>
      </div>
      <template v-else-if="canAddMore">
        <svg class="r2up__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="0" />
          <polyline points="3 15 8 10 12 14 16 10 21 15" />
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
        <p class="r2up__label">
          {{ t('uploader.dragHere') }}
          <button type="button" class="r2up__pick" @click="chooseFiles">{{ t('uploader.browse') }}</button>
        </p>
        <p class="r2up__hint">{{ t('uploader.hintR2') }}</p>
      </template>
      <p v-else class="r2up__full">{{ t('uploader.limitReached') }}</p>

      <input ref="fileInput" type="file" accept="image/*" :multiple="multiple" class="r2up__input" @change="onPick">
    </div>

    <!-- Compress toggle -->
    <div class="r2up__compress">
      <span class="r2up__compress-label">{{ t('uploader.autoCompress') }}</span>
      <div class="r2up__compress-toggle">
        <button type="button" class="r2up__compress-btn" :class="{ active: autoCompress }" @click="autoCompress = true">{{ t('uploader.on') }}</button>
        <button type="button" class="r2up__compress-btn" :class="{ active: !autoCompress }" @click="autoCompress = false">{{ t('uploader.off') }}</button>
      </div>
      <span class="r2up__compress-detail">
        {{ autoCompress ? t('uploader.compressOn', { dim: COMPRESS_MAX_DIM, quality: Math.round(COMPRESS_QUALITY * 100) }) : t('uploader.compressOff') }}
      </span>
    </div>

    <!-- Status -->
      <p v-if="!uploading && resourceLimitStopped" class="r2up__error">
        Upload stopped after Cloudflare Worker limits were hit. Retry failed files after the cooldown.
      </p>
      <p v-if="!uploading && errorCount" class="r2up__error">{{ t('uploader.failed', errorCount, { n: errorCount }) }}</p>
      <p v-if="!uploading && skippedCount" class="r2up__error">{{ t('uploader.skipped', skippedCount, { n: skippedCount }) }}</p>
      <p v-if="!uploading && duplicateCount" class="r2up__note">{{ t('uploader.duplicatesSkipped', duplicateCount, { n: duplicateCount }) }}</p>

      <div v-if="!uploading && failedUploads.length" class="r2up__failures">
        <div class="r2up__failures-head">
          <span>{{ t('uploader.failedListTitle', failedUploads.length, { n: failedUploads.length }) }}</span>
          <button type="button" class="r2up__retry" @click="retryFailed">{{ t('uploader.retryFailed') }}</button>
        </div>
        <ul>
          <li v-for="item in failedUploads.slice(0, 8)" :key="`${item.name}-${item.file.size}-${item.file.lastModified}`">
            <span>{{ item.name }}</span>
            <small>{{ item.reason }}</small>
          </li>
        </ul>
        <p v-if="failedUploads.length > 8" class="r2up__more">
          {{ t('uploader.moreFailed', failedUploads.length - 8, { n: failedUploads.length - 8 }) }}
        </p>
      </div>

    <!-- Previews -->
    <div v-if="showPreviews && model.length" class="r2up__previews">
      <div v-for="key in model" :key="key" class="r2up__thumb">
        <img :src="`/images/${key}`" alt="" loading="lazy">
        <button type="button" class="r2up__remove" :title="t('admin.delete')" @click="removeKey(key)">
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
  flex-direction: column;
  align-items: center;
  width: min(100%, 15rem);
  cursor: default;
}

.r2up__uploading-mark {
  display: flex;
  align-items: flex-end;
  gap: 0.22rem;
  height: 1.1rem;
  margin-bottom: 0.65rem;
}
.r2up__uploading-mark span {
  display: block;
  width: 0.28rem;
  height: 0.55rem;
  background: var(--accent);
  transform-origin: bottom;
  animation: r2upPulse 0.85s ease-in-out infinite;
}
.r2up__uploading-mark span:nth-child(2) { animation-delay: 0.12s; }
.r2up__uploading-mark span:nth-child(3) { animation-delay: 0.24s; }

.r2up__uploading-kicker {
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

.r2up__uploading-count {
  margin-top: 0.3rem;
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 200;
  line-height: 1;
  color: var(--muted);
}
.r2up__uploading-count strong {
  font-weight: 300;
  color: var(--dark);
}
.r2up__uploading-sep {
  margin: 0 0.18em;
  opacity: 0.5;
}

.r2up__uploading-meter {
  width: 100%;
  height: 0.3rem;
  margin-top: 0.85rem;
  background: color-mix(in srgb, var(--subtle) 45%, transparent);
  overflow: hidden;
}
.r2up__uploading-meter span {
  display: block;
  width: 100%;
  height: 100%;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.2s ease-out;
}

.r2up__uploading-pause {
  margin-top: 0.7rem;
  border: 1px solid color-mix(in srgb, #b0243c 28%, var(--subtle));
  padding: 0.38rem 0.52rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.1em;
  line-height: 1.35;
  text-transform: uppercase;
  color: #8f1c30;
  background: color-mix(in srgb, #b0243c 5%, var(--body-bg));
}

.r2up__uploading-stay {
  margin-top: 0.7rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--muted);
}

@keyframes r2upPulse {
  0%, 100% { transform: scaleY(0.45); opacity: 0.55; }
  50% { transform: scaleY(1); opacity: 1; }
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

.r2up__note {
  font-family: var(--font-sans);
  font-size: 0.58rem;
  letter-spacing: 0.06em;
  color: var(--muted);
}

.r2up__failures {
  border: 1px solid color-mix(in srgb, #b0243c 38%, var(--subtle));
  border-top: 2px solid #b0243c;
  background: color-mix(in srgb, #b0243c 4%, var(--body-bg));
}

.r2up__failures-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.65rem;
  border-bottom: 1px solid color-mix(in srgb, #b0243c 25%, var(--subtle));
  color: #b0243c;
  font-family: var(--font-sans);
  font-size: 0.52rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.r2up__retry {
  flex-shrink: 0;
  border: 1px solid #b0243c;
  background: #b0243c;
  color: #F5F4F0;
  padding: 0.38rem 0.6rem;
  font-family: var(--font-sans);
  font-size: 0.48rem;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}
.r2up__retry:hover { background: #8f1c30; border-color: #8f1c30; }

.r2up__failures ul {
  display: grid;
  gap: 1px;
  margin: 0;
  padding: 0;
  list-style: none;
  background: color-mix(in srgb, #b0243c 20%, var(--subtle));
}

.r2up__failures li {
  display: grid;
  gap: 0.18rem;
  min-width: 0;
  padding: 0.52rem 0.65rem;
  background: color-mix(in srgb, var(--body-bg) 70%, white);
}

.r2up__failures li span {
  color: var(--dark);
  font-size: 0.62rem;
  overflow-wrap: anywhere;
}

.r2up__failures li small,
.r2up__more {
  color: #8f1c30;
  font-size: 0.54rem;
  line-height: 1.45;
}

.r2up__more {
  margin: 0;
  padding: 0.52rem 0.65rem;
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
