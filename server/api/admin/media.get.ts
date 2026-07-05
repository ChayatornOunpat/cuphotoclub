export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '')
  if (!prefix) throw createError({ statusCode: 400, statusMessage: 'Missing media prefix' })

  const { blobs } = await blob.list({ prefix, limit: 1000 })
  const images = blobs
    .filter(item => item.contentType?.startsWith('image/'))
    .map(item => ({
      key: item.pathname,
      uploadedAt: item.uploadedAt?.toISOString(),
      size: item.size
    }))

  return {
    keys: images.map(item => item.key),
    images
  }
})
