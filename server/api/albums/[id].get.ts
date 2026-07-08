export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  // Resolve by slug (the public URL) or id (legacy links).
  const album = await albumStore.getBySlug(id)
  if (!album || album.visibility === 'draft') throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return album
})
