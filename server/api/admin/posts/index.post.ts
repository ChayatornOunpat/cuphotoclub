import type { PostInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody<PostInput>(event)

  const error = validatePost(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })
  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'draft'

  const created = await postStore.create(body, user.id)
  await recordAdminAudit(user, {
    action: 'create',
    entityType: 'post',
    entityId: created.id,
    entityTitle: created.title,
    metadata: {
      visibility: created.visibility,
      published: created.published
    }
  })
  await purgeSwrCache()
  return created
})
