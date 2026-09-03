import type { PhotoGridImage } from '~~/server/api/photogrid.get'

export const PHOTO_GRID_BATCH_COUNT = 250

// How many upcoming queue images the grid waits on (fetched + decoded) before
// the swap timer starts rotating.
export const GRID_WARM_DECODE_COUNT = 20

let preloadedImages: PhotoGridImage[] | null = null
let prewarmPromise: Promise<PhotoGridImage[]> | null = null

export interface DecodedGridImage {
  width: number
  height: number
}

// In-flight decode dedupe: the initial fill, the warm gate and swap ticks all
// request the same thumbnails around the same time — this keeps one download
// per src. Settled entries are dropped so failed loads can retry.
const decoding = new Map<string, Promise<DecodedGridImage>>()

// Grid tiles render at most two cells wide (~200px at rowHeight 70), so ask
// Cloudflare Image Transformations for a retina-sized thumb instead of pulling
// the full-size R2 original (~300 KB → ~15 KB). format=auto lets Cloudflare
// pick avif/webp per browser support; results are edge-cached for a year (the
// origin /images route sends immutable cache headers).
export function gridThumbSrc(src: string): string {
  return `/cdn-cgi/image/width=400,quality=75,format=auto${src}`
}

// Fetch + decode an image and resolve with its intrinsic dimensions. Safe to
// call repeatedly/concurrently for the same src.
export function decodeGridImage(src: string): Promise<DecodedGridImage> {
  const pending = decoding.get(src)
  if (pending) return pending

  const task = (async (): Promise<DecodedGridImage> => {
    const img = new Image()
    img.decoding = 'async'
    img.loading = 'eager'
    img.src = src
    if (!img.complete) {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error(`Unable to load photo grid image: ${src}`))
      })
    }
    // Bytes arrived, but the next paint can still miss while the browser
    // decodes — wait for decode before callers flip any visible face.
    if (typeof img.decode === 'function') await img.decode().catch(() => undefined)

    if (!img.naturalWidth || !img.naturalHeight) {
      throw new Error(`Unable to read photo grid image dimensions: ${src}`)
    }
    return { width: img.naturalWidth, height: img.naturalHeight }
  })()

  decoding.set(src, task)
  task.finally(() => {
    if (decoding.get(src) === task) decoding.delete(src)
  }).catch(() => {})
  return task
}

export async function prewarmPhotoGrid() {
  if (preloadedImages) return preloadedImages
  if (prewarmPromise) return prewarmPromise

  prewarmPromise = $fetch<{ images: PhotoGridImage[] }>('/api/photogrid', {
    query: { count: PHOTO_GRID_BATCH_COUNT }
  })
    .then((res) => {
      preloadedImages = res.images ?? []
      return preloadedImages
    })
    .catch(() => {
      // Don't cache the failure: a transient timeout must not poison every
      // later prewarm with an empty catalog until the next full page reload.
      preloadedImages = null
      return [] as PhotoGridImage[]
    })
    .finally(() => {
      prewarmPromise = null
    })

  return prewarmPromise
}

export function consumePrewarmedPhotoGrid() {
  const images = preloadedImages
  preloadedImages = null
  return images
}
