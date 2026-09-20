import type { ImageUsage } from '~~/server/utils/r2Usage'

interface R2InventoryImage {
  key: string
  contentType?: string
  size?: number
  uploadedAt?: string
  orderAt: number
  albums: ImageUsage[]
  usages: ImageUsage[]
}

interface R2InventoryResponse {
  prefix: string
  total: number
  // False until the r2_objects index has been fully checked against the
  // bucket once; the page then drives POST /api/admin/r2-objects/sync.
  indexReady: boolean
  linkedToAlbums: number
  referenced: number
  images: R2InventoryImage[]
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '') || undefined

  // The object list comes from the r2_objects index (server/utils/r2Objects.ts),
  // never from walking the bucket here — see that file for why the walk is a
  // separate, stepped endpoint (POST /api/admin/r2-objects/sync). What points
  // at each object comes from server/utils/r2Usage.ts.
  const cacheKey = prefix ?? ''
  const cached = getCachedR2Inventory<R2InventoryResponse>(cacheKey)
  if (cached) return cached

  const [indexReady, objects, usageMaps] = await Promise.all([
    r2IndexReady(),
    listIndexedR2Images(prefix),
    buildR2UsageMaps(prefix)
  ])

  const images: R2InventoryImage[] = objects
    .filter(item => !usageMaps.trashedKeys.has(item.key))
    .map((item) => {
      const { albums, usages } = usagesForKey(usageMaps, item.key, item.uploadedAt)
      return {
        key: item.key,
        contentType: item.contentType ?? undefined,
        size: item.size,
        uploadedAt: item.uploadedAt.toISOString(),
        // Already sorted by this in SQL (listIndexedR2Images).
        orderAt: item.orderAt,
        albums,
        usages
      }
    })

  const response: R2InventoryResponse = {
    prefix: prefix ?? '',
    total: images.length,
    indexReady,
    linkedToAlbums: images.filter(image => image.albums.length > 0).length,
    referenced: images.filter(image => image.albums.length > 0 || image.usages.length > 0).length,
    images
  }
  setCachedR2Inventory(cacheKey, response)
  return response
})
