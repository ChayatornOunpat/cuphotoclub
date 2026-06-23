import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [album] = await db.select({ id: schema.albums.id }).from(schema.albums).where(eq(schema.albums.id, id)).limit(1)
  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const photos = await db.select({ r2Key: schema.photos.r2Key }).from(schema.photos).where(eq(schema.photos.albumId, id))
  if (photos.length) {
    await blob.delete(photos.map(p => p.r2Key))
    await db.delete(schema.photos).where(eq(schema.photos.albumId, id))
  }
  await db.delete(schema.albums).where(eq(schema.albums.id, id))
  return { ok: true }
})
