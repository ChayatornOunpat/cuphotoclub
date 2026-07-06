import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, id)).limit(1)
  if (!photo) throw createError({ statusCode: 404, message: 'ไม่พบรูปภาพ' })

  await blob.delete(photo.r2Key)

  // If this photo was the album cover, clear it.
  await db
    .update(schema.albums)
    .set({ coverPhotoId: null })
    .where(eq(schema.albums.coverPhotoId, id))

  await db.delete(schema.photos).where(eq(schema.photos.id, id))
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'photo',
    entityId: id,
    entityTitle: photo.caption || photo.r2Key,
    metadata: {
      albumId: photo.albumId,
      r2Key: photo.r2Key
    }
  })
  return { ok: true }
})
