export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const album = await albumStore.get(id)
  if (!(await albumStore.remove(id))) throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  await recordAdminAudit(user, {
    action: 'delete',
    entityType: 'album',
    entityId: id,
    entityTitle: album?.title ?? id,
    metadata: {
      visibility: album?.visibility,
      published: album?.published,
      style: album?.style
    }
  })
  return { ok: true }
})
