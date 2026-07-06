import type { AlbumInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<AlbumInput>(event)
  body.placement = 'gallery'

  const error = validateAlbum(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'public'

  const before = await albumStore.get(id)
  const updated = await albumStore.update(id, body)
  if (!updated) throw createError({ statusCode: 404, statusMessage: 'Album not found' })
  await recordAdminAudit(user, {
    action: 'update',
    entityType: 'album',
    entityId: updated.id,
    entityTitle: updated.title,
    metadata: {
      previousTitle: before?.title,
      previousVisibility: before?.visibility,
      nextVisibility: updated.visibility,
      published: updated.published,
      style: updated.style
    }
  })
  return updated
})
