import type { PostInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<PostInput>(event)

  const error = validatePost(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'public'

  const before = await postStore.get(id)
  const updated = await postStore.update(id, body, user.id)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  await recordAdminAudit(user, {
    action: 'update',
    entityType: 'post',
    entityId: updated.id,
    entityTitle: updated.title,
    metadata: {
      previousTitle: before?.title,
      previousVisibility: before?.visibility,
      nextVisibility: updated.visibility,
      published: updated.published
    }
  })
  await purgeSwrCache()
  return updated
})
