import type { PhotoGridImage } from '~~/server/api/photogrid.get'

export const PHOTO_GRID_BATCH_COUNT = 250

let preloadedImages: PhotoGridImage[] | null = null
let prewarmPromise: Promise<PhotoGridImage[]> | null = null

function warmImageCache(images: PhotoGridImage[]) {
  if (!import.meta.client) return
  for (const image of images.slice(0, 80)) {
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
