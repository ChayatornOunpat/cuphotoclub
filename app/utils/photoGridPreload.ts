import type { PhotoGridImage } from '~~/server/api/photogrid.get'

export const PHOTO_GRID_BATCH_COUNT = 250

let preloadedImages: PhotoGridImage[] | null = null
let prewarmPromise: Promise<PhotoGridImage[]> | null = null

// Warm only about one screenful of tiles. These are full-size R2 originals
// (~300 KB each) — warming 80 of them cost ~24 MB of background download on
// every landing visit. Later flips load lazily as the grid cycles.
const WARM_IMAGE_COUNT = 20

function warmImageCache(images: PhotoGridImage[]) {
  if (!import.meta.client) return
  for (const image of images.slice(0, WARM_IMAGE_COUNT)) {
    const preload = new Image()
    preload.decoding = 'async'
    preload.src = image.src
  }
}

export async function prewarmPhotoGrid() {
  if (preloadedImages) return preloadedImages
  if (prewarmPromise) return prewarmPromise

  prewarmPromise = $fetch<{ images: PhotoGridImage[] }>('/api/photogrid', {
    query: { count: PHOTO_GRID_BATCH_COUNT }
  })
    .then((res) => {
      preloadedImages = res.images ?? []
      warmImageCache(preloadedImages)
      return preloadedImages
    })
    .catch(() => {
      preloadedImages = []
      return preloadedImages
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
