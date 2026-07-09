export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '')
  if (!prefix) throw createError({ statusCode: 400, statusMessage: 'Missing media prefix' })

  const blobs = []
  let cursor: string | undefined
  do {
    const result = await blob.list({ prefix, limit: 1000, cursor })
    blobs.push(...result.blobs)
    cursor = result.hasMore ? result.cursor : undefined
  } while (cursor)

  // Trashed images are kept in R2 but must not be selectable anywhere — hide
  // them from the album image picker just like the R2 inventory does.
  const trashed = await trashedKeySet()

  const images = blobs
    .filter(item => item.contentType?.startsWith('image/') && !trashed.has(item.pathname))
    .map((item) => {
      // Queue-order stamp written at upload time; uploadedAt (completion time)
      // is the fallback for images uploaded before the stamp existed.
      const seq = Number(item.customMetadata?.seq)
      return {
        key: item.pathname,
        uploadedAt: item.uploadedAt?.toISOString(),
        orderAt: Number.isFinite(seq) && seq > 0 ? seq : (item.uploadedAt?.getTime() ?? 0),
        size: item.size
      }
    })

  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  images.sort((a, b) => a.orderAt - b.orderAt || collator.compare(a.key, b.key))

  return {
    keys: images.map(item => item.key),
    images
  }
})
