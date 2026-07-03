export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const post = await postStore.get(id)
  if (!(await postStore.remove(id))) throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  await recordAdminAudit(user, {
    action: 'delete',
    entityType: 'post',
    entityId: id,
    entityTitle: post?.title ?? id,
    metadata: {
      visibility: post?.visibility,
      published: post?.published
    }
  })
  return { ok: true }
})
