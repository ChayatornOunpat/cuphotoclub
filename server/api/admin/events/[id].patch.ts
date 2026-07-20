import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  summary: z.string().trim().nullable().optional(),
  body: z.string().optional(),
  eventDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  coverR2Key: z.string().nullable().optional(),
  registerUrl: z.string().trim().nullable().optional(),
  status: z.enum(['draft', 'published']).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบกิจกรรม' })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) updates.title = data.title
  if (data.summary !== undefined) updates.summary = data.summary
  if (data.body !== undefined) updates.body = data.body
  if (data.location !== undefined) updates.location = data.location
  if (data.registerUrl !== undefined) updates.registerUrl = data.registerUrl || null
  if (data.eventDate !== undefined) updates.eventDate = data.eventDate ? new Date(data.eventDate) : null
  if (data.endDate !== undefined) updates.endDate = data.endDate ? new Date(data.endDate) : null
  {
    const nextStart = (updates.eventDate !== undefined ? updates.eventDate : row.eventDate) as Date | null
    const nextEnd = (updates.endDate !== undefined ? updates.endDate : row.endDate) as Date | null
    if (nextEnd && (!nextStart || nextEnd < nextStart)) {
      throw createError({ statusCode: 400, message: 'วันสิ้นสุดต้องไม่มาก่อนวันเริ่มกิจกรรม' })
    }
  }
  if (data.slug !== undefined) updates.slug = await uniqueSlug(schema.events, data.slug, id)
  if (data.status !== undefined) {
    updates.status = data.status
    if (data.status === 'published' && !row.publishedAt) updates.publishedAt = new Date()
  }
  if (data.coverR2Key !== undefined) {
    updates.coverR2Key = data.coverR2Key
    if (row.coverR2Key && row.coverR2Key !== data.coverR2Key) await blob.delete(row.coverR2Key).catch(() => {})
  }

  await db.update(schema.events).set(updates).where(eq(schema.events.id, id))
  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'event',
    entityId: id,
    entityTitle: String(updates.title ?? row.title),
    metadata: {
      previousTitle: row.title,
      previousStatus: row.status,
      nextStatus: updates.status ?? row.status,
      changed: Object.keys(updates).filter(key => key !== 'updatedAt')
    }
  })
  await purgeSwrCache()
  return { ok: true }
})
