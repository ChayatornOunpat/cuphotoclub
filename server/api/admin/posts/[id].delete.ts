export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  if (!(await postStore.remove(id))) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return { ok: true }
})
