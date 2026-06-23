import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().nullable().optional(),
  eventDate: z.string().nullable().optional(),
  status: z.enum(['draft', 'published']).optional(),
  coverPhotoId: z.number().int().nullable().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const [album] = await db.select().from(schema.albums).where(eq(schema.albums.id, id)).limit(1)
  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) updates.title = data.title
  if (data.description !== undefined) updates.description = data.description
  if (data.coverPhotoId !== undefined) updates.coverPhotoId = data.coverPhotoId
  if (data.eventDate !== undefined) updates.eventDate = data.eventDate ? new Date(data.eventDate) : null
  if (data.slug !== undefined) updates.slug = await uniqueAlbumSlug(data.slug, id)
  if (data.status !== undefined) {
    updates.status = data.status
    if (data.status === 'published' && !album.publishedAt) updates.publishedAt = new Date()
  }

  await db.update(schema.albums).set(updates).where(eq(schema.albums.id, id))
  return { ok: true }
})
