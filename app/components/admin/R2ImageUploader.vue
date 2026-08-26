<script setup lang="ts">
import { isAllowedUploadExt } from '~~/shared/uploadFileTypes'

const { t } = useI18n()

// Tuned in /admin/image-lab against real camera files: 3040 clears a
// full-width album cell (~1284 CSS px) on a 2x display with headroom for
// full-bleed covers, and WebP at 85 holds up at 1:1 while costing roughly half
// the bytes per pixel of the old JPEG at 90. Overridable per instance via props.
const COMPRESS_MAX_DIM_DEFAULT = 3040
const COMPRESS_QUALITY_DEFAULT = 85 // percent

const props = withDefaults(defineProps<{
  prefix?: string
  multiple?: boolean
  maxFiles?: number
  dropzoneClass?: string
  showPreviews?: boolean
  detectDates?: boolean
  // Where the manifest/presign/complete trio lives. The public contribute page
  // points this at its own routes, which share these utils but guard on the
  // contributor cookie instead of an admin session.
  endpointBase?: string
  // Compression policy. On the contribute page these come from the link the
  // admin configured, and showCompressControl is false — a participant never
  // sees a knob for something the admin decided.
  compress?: boolean
  compressMaxDim?: number
  compressQuality?: number
  showCompressControl?: boolean
  // sessionStorage remembers what this browser already uploaded so a reopened
  // modal does not re-send it. Turn it off where a file may legitimately be
  // sent again after being removed — on the contribute page the cache would
  // otherwise make remove-then-re-add impossible.
  rememberSignatures?: boolean
  // Whether AdminUploadDock exists on this page to receive an in-flight upload
  // when the modal unmounts. False on public pages (the contribute page): there
  // is no dock, so closing mid-upload cancels instead of leaving an invisible,
  // unstoppable upload running. Kept separate from rememberSignatures because
  // the two happen to be false together today but mean different things.
  handoffToDock?: boolean
  // Per-file ceiling the *server* will enforce. A contribution link may set this
  // lower than MAX_UPLOAD_BYTES, and the client must know: otherwise a phone
  // spends minutes uploading a file that gets refused on arrival.
  maxBytes?: number
}>(), {
  prefix: 'uploads',
  multiple: true,
  maxFiles: 0,
  dropzoneClass: '',
  showPreviews: true,
  detectDates: false,
  endpointBase: '/api/admin/upload/sessions',
  compress: true,
  compressMaxDim: COMPRESS_MAX_DIM_DEFAULT,
  compressQuality: COMPRESS_QUALITY_DEFAULT,
  showCompressControl: true,
  rememberSignatures: true,
  handoffToDock: true,
  maxBytes: 0
})

// Effective policy: props win, so the admin uploader keeps today's behaviour and
// the contribute page follows its link. maxBytes is clamped — a link may ask for
// less than the hard cap, never more.
const effectiveMaxBytes = computed(() =>
  props.maxBytes > 0 ? Math.min(props.maxBytes, MAX_UPLOAD_BYTES) : MAX_UPLOAD_BYTES)
const maxBytesLabel = computed(() => Math.round(effectiveMaxBytes.value / (1024 * 1024)))
const compressMaxDim = computed(() => props.compressMaxDim || COMPRESS_MAX_DIM_DEFAULT)
const compressQuality = computed(() => (props.compressQuality || COMPRESS_QUALITY_DEFAULT) / 100)

const model = defineModel<string[]>({ default: () => [] })
const emit = defineEmits<{
  uploaded: [keys: string[]]
  datesDetected: [range: { start: string, end: string, count: number }]
}>()

const { detect: detectExifRange } = useExifDateRange()
const task = useUploadTask()

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
const dragOver = ref(false)
const total = ref(0)
const done = ref(0)
const errorCount = ref(0)
const cancelledCount = ref(0)
const skippedCount = ref(0)
const duplicateCount = ref(0)
const rejectedCount = ref(0)
const resourcePauseSeconds = ref(0)
const resourceLimitStopped = ref(false)
const pendingQueue = ref<File[]>([])
const failedUploads = ref<Array<{ file: File, name: string, reason: string }>>([])
const completedSignatures = new Set<string>()

const COMPRESS_MIN_BYTES = 200_000
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
const UPLOAD_CONCURRENCY = 3
const UPLOAD_BATCH_DELAY_MS = 1_000
const UPLOAD_SESSION_SIZE = 250
const RESOURCE_LIMIT_PAUSE_MS = 30_000

const autoCompress = ref(props.compress)
// The contribute page learns its policy from the API after mount, so the prop
// can change once after the first render.
watch(() => props.compress, (value) => { autoCompress.value = value })
let resourcePausePromise: Promise<void> | null = null
let resourcePauseTimer: ReturnType<typeof setInterval> | null = null
let shouldStopCurrentUpload = false
let uploadSignal: AbortSignal | null = null
const fileOrderCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

interface UploadManifestItem {
  file: File
  toUpload: File
  hash: string
  key: string
  seq: number
  exists: boolean
  sessionId?: string
  itemId?: string
  status?: string
}

interface PrepFailure {
  file: File
  prepFailed: true
  prepError: string
}

// Queue-order stamp sent with each upload. R2's uploadedAt records completion
// time, which scrambles under parallel uploads. Stamp from the original file
// index before compression/upload workers start, so 300+ file batches remain
// stable across session chunks and retries.
function uploadOrderSeq(base: number, index: number) {
  return base + index
}

function fileSignature(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`
}

function fileOrderName(file: File) {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
}

function normalizeUploadOrder(files: File[]) {
  return [...files].sort((a, b) =>
    fileOrderCollator.compare(fileOrderName(a), fileOrderName(b))
      || a.lastModified - b.lastModified
      || a.size - b.size
  )
}

function prepareId(file: File) {
  return fileSignature(file)
}

function signatureStorageKey() {
  // Keyed on the endpoint too: the contribute page sends no prefix (the server
  // decides it), so prefix alone would collide across events and make one
  // event's resume cache suppress another's uploads.
  return `cu-r2-uploaded-signatures:${props.endpointBase}:${props.prefix}`
}

function loadCompletedSignatures() {
  if (!import.meta.client || !props.rememberSignatures) return
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
  if (!props.rememberSignatures) return
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

// Extension, not MIME type: raw camera files (.cr2, .nef, .arw, .dng, ...) get
// sniffed by the OS/browser as all sorts of things — sometimes empty, sometimes
// an image/* type for TIFF-based raw formats — so a MIME check alone lets them
// through inconsistently. The extension is what we actually control.
function isAllowedPhotoFile(file: File) {
  return isAllowedUploadExt(fileExt(file))
}

function isHeicFile(file: File) {
  const ext = fileExt(file)
  return ext === 'heic' || ext === 'heif'
}

// Upload failures arrive as $fetch FetchError, raw Error, or whatever a Worker
// returned — never one shape, so everything below narrows through `unknown`.
function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

function errStatusCode(err: unknown): number {
  const value = asRecord(err)?.statusCode
  return typeof value === 'number' ? value : 0
}

function firstString(...values: unknown[]) {
  return values.find(value => typeof value === 'string' && value) as string | undefined
}

function rawUploadError(err: unknown) {
  const record = asRecord(err)
  const data = record?.data ?? asRecord(record?.response)?._data
  if (typeof data === 'string') return data
  const dataRecord = asRecord(data)
  return firstString(dataRecord?.message, dataRecord?.statusMessage, record?.message, record?.statusMessage) ?? ''
}

function isWorkerResourceLimitError(err: unknown) {
  const raw = rawUploadError(err)
  return /Worker exceeded resource limits|Error 1102|exceeded resource limits/i.test(raw)
    || (errStatusCode(err) >= 500 && /cloudflare|worker|fetch|network|response/i.test(raw || String(asRecord(err)?.name ?? '')))
}

function uploadErrorMessage(err: unknown) {
  const raw = rawUploadError(err)

  if (isWorkerResourceLimitError(err)) {
    return t('uploader.errBusy')
  }
  if (/Failed to fetch|fetch failed|NetworkError/i.test(raw)) {
    return t('uploader.errNetwork')
  }
  if (errStatusCode(err) === 413 || /too large|ใหญ่เกิน/i.test(raw)) {
    return t('uploader.errTooLarge', { mb: maxBytesLabel.value })
  }
  return raw ? String(raw).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220) : t('uploader.errUnknown')
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

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index]!, index)
    }
  })
  await Promise.all(workers)
  return results
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

// WebP is roughly 30% smaller than JPEG at the same visual quality, which is
// the only compression the album walls ever get (they're excluded from
// /cdn-cgi/image transforms by the free-tier quota). Encoders that can't
// produce it must fall back to JPEG rather than to toBlob's silent PNG, which
// would be *larger* than the JPEG it replaced — so probe once with a 1x1
// canvas and cache the answer for the life of this uploader.
let webpEncodeProbe: Promise<boolean> | null = null
function supportsWebpEncode() {
  if (!webpEncodeProbe) {
    webpEncodeProbe = new Promise<boolean>((resolve) => {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      canvas.toBlob(blob => resolve(blob?.type === 'image/webp'), 'image/webp', 0.9)
    })
  }
  return webpEncodeProbe
}

// createImageBitmap() cannot decode HEIC/HEIF outside Safari, so every other
// browser throws inside compressImage(). iOS often transcodes to JPEG when a
// file is picked through <input type="file">, but a HEIC arriving from a Mac
// Finder drag, an Android file manager, or Safari's own "keep original" export
// setting will not — so decode it explicitly first, unconditionally (not just
// when auto-compress is on), since an undecoded HEIC is unusable on the wall
// either way.
async function convertHeic(file: File): Promise<File> {
  const { default: heic2any } = await import('heic2any')
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 })
  const blob = Array.isArray(result) ? result[0]! : result
  const name = file.name.replace(/[.][^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}

async function compressImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file)
  let w = bmp.width, h = bmp.height
  const maxDim = compressMaxDim.value
  if (w > maxDim || h > maxDim) {
    if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim }
    else        { w = Math.round(w * maxDim / h); h = maxDim }
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  const type = (await supportsWebpEncode()) ? 'image/webp' : 'image/jpeg'
  const compressed = await new Promise<Blob>((res, rej) =>
    canvas.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), type, compressQuality.value)
  )
  // Never ship a result larger than the original. When the original wins, hand
  // it back untouched: re-wrapping it under the encoder's name and MIME type
  // would store a wrong content-type on the R2 object (a PNG that compresses
  // badly used to be saved as "image/jpeg").
  if (compressed.size >= file.size) return file
  const name = file.name.replace(/[.][^.]+$/, '') + (type === 'image/webp' ? '.webp' : '.jpg')
  return new File([compressed], name, { type })
}

const canAddMore = computed(() => !props.maxFiles || model.value.length < props.maxFiles)

// True while any upload runs — this instance's own, or a background one started
// by a previous (unmounted) instance. Progress renders from the shared task so
// a reopened modal shows the running upload instead of an empty dropzone.
const uploadActive = computed(() => uploading.value || task.value.status === 'uploading')

const progressPercent = computed(() =>
  task.value.total ? Math.min(100, Math.round((task.value.done / task.value.total) * 100)) : 0
)

// Warn before closing/refreshing the tab while an upload is in flight.
function onBeforeUnload(e: BeforeUnloadEvent) {
  if (!uploadActive.value) return
  e.preventDefault()
  e.returnValue = ''
}
onMounted(() => {
  loadCompletedSignatures()
  window.addEventListener('beforeunload', onBeforeUnload)
  // Adopt a background upload: show it here and hide the floating dock.
  if (task.value.status === 'uploading') task.value.ownerVisible = true
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  if (resourcePauseTimer) clearInterval(resourcePauseTimer)
  // Closing the modal does not cancel the upload — hand the task off to the
  // floating dock. A finished task is cleared unless it still has failures or
  // cancellations worth surfacing in the dock.
  //
  // Without a dock to receive it (public pages) an uploading task would keep
  // running invisibly with no progress and no way to stop it, so cancel instead.
  if (task.value.status === 'uploading' && !props.handoffToDock) {
    requestUploadCancel(task)
    task.value.status = 'idle'
  }
  else if (task.value.status === 'uploading') task.value.ownerVisible = false
  else if (!task.value.errorCount && !task.value.cancelledCount) task.value.status = 'idle'
  else task.value.ownerVisible = false
})

function chooseFiles() {
  if (!uploadActive.value && canAddMore.value) fileInput.value?.click()
}

async function createUploadSessionBatch(files: File[], sessionStart: number, sequenceBase: number) {
  const prepared = await mapWithConcurrency<File, UploadManifestItem | PrepFailure>(
    files,
    UPLOAD_CONCURRENCY,
    async (file, index) => {
      try {
        const decoded = isHeicFile(file) ? await convertHeic(file) : file
        const toUpload = autoCompress.value && decoded.size > COMPRESS_MIN_BYTES ? await compressImage(decoded) : decoded
        return {
          file,
          toUpload,
          hash: await contentHash(toUpload),
          key: '',
          seq: uploadOrderSeq(sequenceBase, sessionStart + index),
          exists: false
        }
      } catch (err) {
        const failure: PrepFailure = {
          file,
          prepFailed: true,
          prepError: isHeicFile(file) ? t('uploader.errHeicFailed') : uploadErrorMessage(err)
        }
        return failure
      }
    }
  )

  // A HEIC decode failure (or any other per-file prep error) only takes out
  // that one file — record it and keep the rest of the batch moving, rather
  // than failing every file in the session over one bad input.
  for (const item of prepared) {
    if ('prepFailed' in item) markUploadFailed(item.file, item.prepError)
  }
  const okItems = prepared.filter((item): item is UploadManifestItem => !('prepFailed' in item))
  if (!okItems.length) return []

  const session = await $fetch<{
    id: string
    items: Array<{ id: string, key: string, status: string }>
  }>(props.endpointBase, {
    method: 'POST',
    body: {
      prefix: props.prefix,
      files: okItems.map(item => ({
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
  return okItems.map((item) => {
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
  uploadedKeySet: Set<string>
) {
  const signature = fileSignature(item.file)
  let stoppedByResourceLimit = false
  try {
    if (item.toUpload.size > effectiveMaxBytes.value) {
      throw new Error(t('uploader.errTooLarge', { mb: maxBytesLabel.value }))
    }

    if (item.exists && item.key) {
      duplicateCount.value++
      if (!model.value.includes(item.key) && !uploadedKeySet.has(item.key)) {
        uploadedKeySet.add(item.key)
        uploadedKeys.push(item.key)
        task.value.uploadedCount = uploadedKeys.length
      }
      rememberCompletedSignature(signature)
      return false
    }

    if (item.sessionId && item.itemId) {
      const { key } = await uploadPreparedFileDirect(item)
      if (!model.value.includes(key) && !uploadedKeySet.has(key)) {
        uploadedKeySet.add(key)
        uploadedKeys.push(key)
        task.value.uploadedCount = uploadedKeys.length
      }
      rememberCompletedSignature(signature)
      return false
    }

    throw new Error('Upload manifest item is missing session identity.')
  } catch (err) {
    // A user cancel aborts in-flight requests; those failures are cancellations,
    // not errors.
    if (task.value.cancelRequested) {
      cancelledCount.value++
      task.value.cancelledCount = cancelledCount.value
      return false
    }
    errorCount.value++
    task.value.errorCount = errorCount.value
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
    task.value.done = done.value
  }
  return stoppedByResourceLimit
}

async function uploadPreparedFileDirect(item: UploadManifestItem) {
  if (!item.sessionId || !item.itemId) throw new Error('Upload manifest item is missing session identity.')

  const base = `${props.endpointBase}/${encodeURIComponent(item.sessionId)}/items/${encodeURIComponent(item.itemId)}`
  const presigned = await $fetch<{
    key: string
    status: string
    duplicate?: boolean
    upload?: { url: string, headers: Record<string, string>, expiresAt: string }
  }>(`${base}/presign`, {
    method: 'POST',
    body: { seq: item.seq },
    signal: uploadSignal ?? undefined
  })

  // Already in R2 — nothing to upload, but still confirm it. complete is the
  // only place a submission row is created, and it is idempotent, so skipping
  // it here is what used to leave a contributor with no record of their photo.
  if (presigned.duplicate || presigned.status === 'exists' || presigned.status === 'uploaded') {
    duplicateCount.value++
    // No catch: complete creates the submission row, so a failure here has to
    // land in the retryable-failure path rather than report a photo that only
    // half-exists. Retrying re-presigns, hits the duplicate branch again, and
    // re-completes — which is why complete must be idempotent.
    await $fetch<{ key: string }>(`${base}/complete`, { method: 'POST' })
    return { key: presigned.key }
  }
  if (!presigned.upload) {
    throw new Error('Direct R2 upload did not return an upload URL.')
  }

  // The completion call carries no signal on purpose: once the PUT landed,
  // aborting between PUT and complete would strand an unconfirmed object.
  const response = await fetch(presigned.upload.url, {
    method: 'PUT',
    headers: presigned.upload.headers,
    body: item.toUpload,
    signal: uploadSignal ?? undefined
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Direct R2 upload failed (${response.status}). ${body}`.trim())
  }

  return await $fetch<{ key: string }>(`${base}/complete`, { method: 'POST' })
}

function markUploadFailed(file: File, reason: string) {
  errorCount.value++
  done.value++
  failedUploads.value.push({ file, name: file.name, reason })
  task.value.errorCount = errorCount.value
  task.value.done = done.value
}

function markUploadStopped(files: File[]) {
  if (!files.length) return
  const reason = 'Not attempted because Cloudflare Worker limits were hit. Retry failed files after the cooldown.'
  for (const file of files) {
    errorCount.value++
    done.value++
    failedUploads.value.push({ file, name: file.name, reason })
  }
  task.value.errorCount = errorCount.value
  task.value.done = done.value
}

function markUploadCancelled(files: File[]) {
  if (!files.length) return
  cancelledCount.value += files.length
  done.value += files.length
  task.value.cancelledCount = cancelledCount.value
  task.value.done = done.value
}

async function uploadMany(files: File[], uploadedKeys: string[], uploadedKeySet: Set<string>, sequenceBase: number) {
  for (let sessionStart = 0; sessionStart < files.length; sessionStart += UPLOAD_SESSION_SIZE) {
    if (task.value.cancelRequested) {
      markUploadCancelled(files.slice(sessionStart))
      break
    }
    if (shouldStopCurrentUpload) {
      markUploadStopped(files.slice(sessionStart))
      break
    }

    await waitForResourceLimitPause()
    if (task.value.cancelRequested) {
      markUploadCancelled(files.slice(sessionStart))
      break
    }
    if (shouldStopCurrentUpload) {
      markUploadStopped(files.slice(sessionStart))
      break
    }

    const sessionFiles = files.slice(sessionStart, sessionStart + UPLOAD_SESSION_SIZE)
    let preparedSession: Awaited<ReturnType<typeof createUploadSessionBatch>>
    try {
      preparedSession = await createUploadSessionBatch(sessionFiles, sessionStart, sequenceBase)
    } catch (err) {
      const message = uploadErrorMessage(err)
      for (const file of sessionFiles) {
        markUploadFailed(file, message)
      }
      if (isWorkerResourceLimitError(err)) {
        shouldStopCurrentUpload = true
        resourceLimitStopped.value = true
        beginResourceLimitPause()
        markUploadStopped(files.slice(sessionStart + UPLOAD_SESSION_SIZE))
        return
      }
      continue
    }

    for (let index = 0; index < preparedSession.length; index += UPLOAD_CONCURRENCY) {
      if (task.value.cancelRequested) {
        markUploadCancelled([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
      if (shouldStopCurrentUpload) {
        markUploadStopped([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
      await waitForResourceLimitPause()
      if (task.value.cancelRequested) {
        markUploadCancelled([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
      if (shouldStopCurrentUpload) {
        markUploadStopped([...preparedSession.slice(index).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }

      const batch = preparedSession.slice(index, index + UPLOAD_CONCURRENCY)
      const stopped = await Promise.all(batch.map(item => uploadPreparedFile(item, uploadedKeys, uploadedKeySet)))
      if (task.value.cancelRequested) {
        markUploadCancelled([...preparedSession.slice(index + UPLOAD_CONCURRENCY).map(item => item.file), ...files.slice(sessionStart + UPLOAD_SESSION_SIZE)])
        return
      }
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
  // Do not accept another batch while an upload is in progress — including a
  // background upload owned by a previous instance of this component.
  if (uploadActive.value) {
    return
  }

  duplicateCount.value = 0
  const photos = files.filter(isAllowedPhotoFile)
  rejectedCount.value = files.length - photos.length
  const images = uniqueUncompleted(photos)
  if (!images.length) return

  // Read EXIF capture dates from the originals (before compression strips them)
  // and report the detected range. Runs alongside the upload; never blocks it.
  if (props.detectDates && !retry) {
    detectExifRange(photos)
      .then((range) => {
        if (range.start) emit('datesDetected', { start: range.start, end: range.end, count: range.withDate })
      })
      .catch(() => {})
  }

  uploading.value = true
  shouldStopCurrentUpload = false
  resourceLimitStopped.value = false
  errorCount.value = 0
  cancelledCount.value = 0
  skippedCount.value = 0
  if (!retry) failedUploads.value = []
  total.value = images.length

  const abortController = new AbortController()
  uploadSignal = abortController.signal
  registerUploadAbort(abortController)
  task.value = {
    status: 'uploading',
    total: images.length,
    done: 0,
    uploadedCount: 0,
    errorCount: 0,
    cancelledCount: 0,
    cancelRequested: false,
    ownerVisible: true
  }

  let batch = images
  const allUploadedKeys: string[] = []
  const uploadedKeySet = new Set<string>()
  const sequenceBase = Date.now()
  let sequenceOffset = 0

  while (batch.length) {
    // model isn't updated until after the loop, so count this run's uploads too.
    const used = model.value.length + allUploadedKeys.length
    const slotsLeft = props.maxFiles ? Math.max(props.maxFiles - used, 0) : batch.length
    const toProcess = batch.slice(0, props.multiple ? slotsLeft : 1)

    if (!toProcess.length) break

    batch = batch.slice(toProcess.length)

    await uploadMany(toProcess, allUploadedKeys, uploadedKeySet, sequenceBase + sequenceOffset)
    sequenceOffset += toProcess.length

    if (shouldStopCurrentUpload || task.value.cancelRequested) break
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
  registerUploadAbort(null)
  uploadSignal = null
  task.value.status = task.value.cancelRequested ? 'cancelled' : 'done'
  if (fileInput.value) fileInput.value.value = ''
}

function cancelUpload() {
  requestUploadCancel(task)
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

function onDragOver() {
  dragOver.value = !uploadActive.value && canAddMore.value
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (uploadActive.value || !canAddMore.value || !e.dataTransfer?.files?.length) return
  upload(normalizeUploadOrder(Array.from(e.dataTransfer.files)))
}
</script>

<template>
  <div class="r2up">
    <!-- Dropzone -->
    <div
      class="r2up__zone"
      :class="[
        dragOver ? 'is-drag-over' : '',
        uploadActive ? 'is-uploading' : '',
        !canAddMore ? 'is-full' : '',
        dropzoneClass
      ]"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div v-if="uploadActive" class="r2up__uploading">
        <div class="r2up__uploading-mark" aria-hidden="true">
          <span /><span /><span />
        </div>
        <p class="r2up__uploading-kicker">{{ t('uploader.uploadingKicker') }}</p>
        <p class="r2up__uploading-count">
          <strong>{{ task.done }}</strong>
          <span class="r2up__uploading-sep">/</span>
          {{ task.total }}
        </p>
        <div class="r2up__uploading-meter" role="progressbar" :aria-valuenow="progressPercent" aria-valuemin="0" aria-valuemax="100">
          <span :style="{ transform: `scaleX(${progressPercent / 100})` }" />
        </div>
        <p v-if="resourcePauseSeconds" class="r2up__uploading-pause">
          {{ t('uploader.resourcePause', { seconds: resourcePauseSeconds }) }}
        </p>
        <button type="button" class="r2up__cancel" :disabled="task.cancelRequested" @click="cancelUpload">
          {{ task.cancelRequested ? t('uploader.cancelling') : t('uploader.cancel') }}
        </button>
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
        <!-- With compression on there is no input-size limit to state: the cap is
             checked against the *compressed* file, and a 3040px re-encode never
             approaches it. Naming a ceiling here only reads as one on the file
             being picked. Compression off is the case where it really applies. -->
        <p class="r2up__hint">
          {{ autoCompress ? t('uploader.hintR2Compressed') : t('uploader.hintR2', { mb: maxBytesLabel }) }}
        </p>
      </template>
      <p v-else class="r2up__full">{{ t('uploader.limitReached') }}</p>

      <input ref="fileInput" type="file" accept="image/*" :multiple="multiple" class="r2up__input" @change="onPick">
    </div>

    <!-- Compress toggle -->
    <div v-if="showCompressControl" class="r2up__compress">
      <span class="r2up__compress-label">{{ t('uploader.autoCompress') }}</span>
      <div class="r2up__compress-toggle">
        <button type="button" class="r2up__compress-btn" :class="{ active: autoCompress }" @click="autoCompress = true">{{ t('uploader.on') }}</button>
        <button type="button" class="r2up__compress-btn" :class="{ active: !autoCompress }" @click="autoCompress = false">{{ t('uploader.off') }}</button>
      </div>
      <span class="r2up__compress-detail">
        {{ autoCompress ? t('uploader.compressOn', { dim: compressMaxDim, quality: Math.round(compressQuality * 100) }) : t('uploader.compressOff') }}
      </span>
    </div>

    <!-- Status -->
      <p v-if="!uploading && resourceLimitStopped" class="r2up__error">
        Upload stopped after Cloudflare Worker limits were hit. Retry failed files after the cooldown.
      </p>
      <p v-if="!uploading && rejectedCount" class="r2up__error">{{ t('uploader.rejectedType', { n: rejectedCount }, rejectedCount) }}</p>
      <p v-if="!uploading && errorCount" class="r2up__error">{{ t('uploader.failed', { n: errorCount }, errorCount) }}</p>
      <p v-if="!uploading && skippedCount" class="r2up__error">{{ t('uploader.skipped', { n: skippedCount }, skippedCount) }}</p>
      <p v-if="!uploading && cancelledCount" class="r2up__note">{{ t('uploader.cancelledNote', { n: cancelledCount }, cancelledCount) }}</p>
      <p v-if="!uploading && duplicateCount" class="r2up__note">{{ t('uploader.duplicatesSkipped', { n: duplicateCount }, duplicateCount) }}</p>

      <div v-if="!uploading && failedUploads.length" class="r2up__failures">
        <div class="r2up__failures-head">
          <span>{{ t('uploader.failedListTitle', { n: failedUploads.length }, failedUploads.length) }}</span>
          <button type="button" class="r2up__retry" @click="retryFailed">{{ t('uploader.retryFailed') }}</button>
        </div>
        <ul>
          <li v-for="item in failedUploads.slice(0, 8)" :key="`${item.name}-${item.file.size}-${item.file.lastModified}`">
            <span>{{ item.name }}</span>
            <small>{{ item.reason }}</small>
          </li>
        </ul>
        <p v-if="failedUploads.length > 8" class="r2up__more">
          {{ t('uploader.moreFailed', { n: failedUploads.length - 8 }, failedUploads.length - 8) }}
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
.r2up__zone.is-uploading {
  cursor: progress;
}
.r2up__zone.is-uploading:hover {
  border-color: var(--subtle);
  border-style: dashed;
  background: color-mix(in srgb, var(--body-bg) 60%, white);
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

.r2up__cancel {
  margin-top: 0.85rem;
  border: 1px solid var(--subtle);
  background: none;
  padding: 0.4rem 0.85rem;
  font-family: var(--font-sans);
  font-size: 0.5rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.r2up__cancel:hover:not(:disabled) { color: #b0243c; border-color: #b0243c; }
.r2up__cancel:disabled { opacity: 0.55; cursor: default; }

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
