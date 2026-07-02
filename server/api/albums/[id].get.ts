export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const album = await albumStore.get(id)
  if (!album || album.visibility === 'draft') throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return album
})
