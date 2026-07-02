export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')!
  const post = await postStore.get(id)
  if (!post || post.visibility === 'draft') throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return post
})
