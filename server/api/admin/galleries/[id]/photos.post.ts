import { eq, sql } from 'drizzle-orm'

// Single-file upload for legacy gallery photos. R2 manager uploads use the direct
// presigned flow; this route is only for adding photos directly inside a gallery.
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
  if (file.data.length > MAX_UPLOAD_BYTES) throw createError({ statusCode: 413, message: 'ไฟล์ใหญ่เกิน 15MB' })

  const width = Number(form?.find(p => p.name === 'width')?.data?.toString()) || null
  const height = Number(form?.find(p => p.name === 'height')?.data?.toString()) || null

  const ext = sanitizeUploadExt(file.filename?.split('.').pop() || 'jpg')
  const key = `photos/${album.slug}/originals/${crypto.randomUUID()}.${ext}`
  await blob.put(key, file.data, { contentType: type })

  const [maxOrderRow] = await db
    .select({ maxOrder: sql<number>`coalesce(max(sort_order), -1)` })
    .from(schema.photos)
    .where(eq(schema.photos.albumId, albumId))

  const [created] = await db
    .insert(schema.photos)
    .values({ albumId, r2Key: key, width, height, sortOrder: Number(maxOrderRow!.maxOrder) + 1 })
    .returning()
  if (!created) throw createError({ statusCode: 500, message: 'บันทึกรูปภาพไม่สำเร็จ' })

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
