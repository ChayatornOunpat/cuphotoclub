export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const post = await postStore.get(id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return post
})
