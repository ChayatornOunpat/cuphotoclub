export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')!
  const post = postStore.get(id)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return post
})
