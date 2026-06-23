import { asc, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [album] = await db.select().from(schema.albums).where(eq(schema.albums.id, id)).limit(1)
  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const photos = await db
    .select()
    .from(schema.photos)
    .where(eq(schema.photos.albumId, id))
    .orderBy(asc(schema.photos.sortOrder), asc(schema.photos.id))

  return { album, photos }
})
