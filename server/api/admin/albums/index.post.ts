import type { AlbumInput } from '~~/shared/types'

// Album-first flow: media is uploaded directly into content-albums/<id>/ via a
// draft created up front (see draft.post.ts), so creating/saving an album never
// moves R2 objects. This endpoint just persists album metadata + rows.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const body = await readBody<AlbumInput>(event)
  body.placement = 'gallery'

  const error = validateAlbum(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'draft'

  const album = await albumStore.create(body)

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'album',
    entityId: album.id,
    entityTitle: album.title,
    metadata: {
      visibility: album.visibility,
      published: album.published,
      style: album.style
    }
  })

  return album
})
