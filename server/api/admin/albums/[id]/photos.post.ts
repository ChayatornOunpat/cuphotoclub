import { eq, sql } from 'drizzle-orm'

const MAX_BYTES = 15 * 1024 * 1024 // 15MB

// Single-file upload (the uploader posts one file at a time, with client-measured dimensions).
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const albumId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(albumId)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [album] = await db.select({ id: schema.albums.id, slug: schema.albums.slug, title: schema.albums.title }).from(schema.albums).where(eq(schema.albums.id, albumId)).limit(1)
  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const form = await readMultipartFormData(event)
  const file = form?.find(p => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 400, message: 'ไม่พบไฟล์' })

  const type = file.type || ''
  if (!type.startsWith('image/')) throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, message: 'ไฟล์ใหญ่เกิน 15MB' })

  const width = Number(form?.find(p => p.name === 'width')?.data?.toString()) || null
  const height = Number(form?.find(p => p.name === 'height')?.data?.toString()) || null

  const ext = (file.filename?.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const key = `photos/${album.slug}/originals/${crypto.randomUUID()}.${ext}`
  await blob.put(key, file.data, { contentType: type })

  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
    .from(schema.photos)
    .where(eq(schema.photos.albumId, albumId))

  const [created] = await db
    .insert(schema.photos)
    .values({ albumId, r2Key: key, width, height, sortOrder: Number(maxOrder) + 1 })
    .returning()

  await db.update(schema.albums).set({ updatedAt: new Date() }).where(eq(schema.albums.id, albumId))
  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'photo',
    entityId: created.id,
    entityTitle: file.filename ?? key,
    metadata: {
      albumId,
      albumTitle: album.title,
      r2Key: key,
      width,
      height
    }
  })
  return created
})
