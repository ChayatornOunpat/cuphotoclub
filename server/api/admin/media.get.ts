export default defineEventHandler(async (event) => {
  await requireUserSession(event)

  const query = getQuery(event)
  const prefix = String(query.prefix || '').replace(/[^a-z0-9/_-]/gi, '')
  if (!prefix) throw createError({ statusCode: 400, statusMessage: 'Missing media prefix' })

  const { blobs } = await blob.list({ prefix, limit: 1000 })
  return {
    keys: blobs
      .filter(item => item.contentType?.startsWith('image/'))
      .map(item => item.pathname)
  }
})
