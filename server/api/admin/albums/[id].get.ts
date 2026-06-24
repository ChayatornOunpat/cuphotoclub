export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const album = albumStore.get(id)
  if (!album) throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return album
})
