export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  if (!(await albumStore.remove(id))) throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  return { ok: true }
})
