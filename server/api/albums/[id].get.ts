export default defineEventHandler(async (event) => {
  // decode: slugs may contain Thai (percent-encoded in the URL); h3 does not
  // decode router params by default.
  const id = getRouterParam(event, 'id', { decode: true })!
  // Resolve by slug (the public URL) or id (legacy links).
  const album = await albumStore.getBySlug(id)
  if (!album || album.visibility === 'draft') throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return album
})
