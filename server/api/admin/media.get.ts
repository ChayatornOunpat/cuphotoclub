export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '')
  if (!prefix) throw createError({ statusCode: 400, statusMessage: 'Missing media prefix' })

  const { blobs } = await blob.list({ prefix, limit: 1000 })
  const images = blobs
    .filter(item => item.contentType?.startsWith('image/'))
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

  images.sort((a, b) => b.orderAt - a.orderAt || a.key.localeCompare(b.key))

  return {
    keys: images.map(item => item.key),
    images
  }
})
