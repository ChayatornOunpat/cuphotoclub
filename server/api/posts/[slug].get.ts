// Public: a published (or link-only) post, block content included.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''

  const post = await postStore.get(slug)
  if (!post || post.visibility === 'draft') throw createError({ statusCode: 404, message: 'ไม่พบบทความ' })

  return post
})
