import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [album] = await db.select().from(schema.albums).where(eq(schema.albums.id, id)).limit(1)
  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const [{ photoCount }] = await db
    .select({ photoCount: sql<number>`count(*)` })
    .from(schema.photos)
    .where(eq(schema.photos.albumId, id))

  await db.delete(schema.photos).where(eq(schema.photos.albumId, id))
  await db.delete(schema.albums).where(eq(schema.albums.id, id))

  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'gallery',
    entityId: id,
    entityTitle: album.title,
    metadata: {
      slug: album.slug,
      status: album.status,
      photoCount,
      r2BlobsDeleted: false
    }
  })

  return { ok: true, photoCount }
})
