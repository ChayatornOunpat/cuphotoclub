import type { PostInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readBody<PostInput>(event)

  const error = validatePost(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'draft'

  return await postStore.create(body)
})
