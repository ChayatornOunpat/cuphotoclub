import type { ImageUsage } from '~~/server/utils/r2Usage'

// The biggest objects in storage, with what points at each one — the data
// behind /admin/largest-files, which is where an admin looks at a big file and
// decides whether to keep it.
//
// Every number here is measured, never estimated: sizes and dates come from
// the r2_objects index (server/utils/r2Objects.ts), references from
// server/utils/r2Usage.ts. The page shows no savings or duration guesses.

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

interface LargestFile {
  key: string
  size: number
  contentType?: string
  uploadedAt: string
  albums: ImageUsage[]
  usages: ImageUsage[]
  referenced: boolean
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const requested = Number(getQuery(event).limit)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : DEFAULT_LIMIT))

  const [indexReady, objects, usageMaps, usage] = await Promise.all([
    r2IndexReady(),
    listLargestR2Objects(limit),
    buildR2UsageMaps(),
    r2StorageUsage()
  ])

  const files: LargestFile[] = objects.map((item) => {
    const { albums, usages } = usagesForKey(usageMaps, item.key, item.uploadedAt)
    return {
      key: item.key,
      size: item.size,
      contentType: item.contentType ?? undefined,
      uploadedAt: item.uploadedAt.toISOString(),
      albums,
      usages,
      referenced: albums.length > 0 || usages.length > 0
    }
  })

  return {
    indexReady,
    limit,
    files,
    // Totals for the whole bucket, so the page can say what share these files
    // are of everything stored.
    totalCount: usage.totalCount,
    totalBytes: usage.totalBytes,
    shownBytes: files.reduce((sum, file) => sum + file.size, 0)
  }
})
