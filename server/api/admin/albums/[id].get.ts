export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  // Resolve by slug (the URL) or id (legacy links).
  const album = await albumStore.getBySlug(id)
  if (!album) throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return album
})
