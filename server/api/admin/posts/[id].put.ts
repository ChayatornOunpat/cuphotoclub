import type { PostInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<PostInput>(event)

  const error = validatePost(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  if (!body.published) body.published = new Date().toISOString().slice(0, 10)

  const updated = await postStore.update(id, body)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  return updated
})
