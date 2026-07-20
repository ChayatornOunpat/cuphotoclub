import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบกิจกรรม' })

  if (row.coverR2Key) await blob.delete(row.coverR2Key).catch(() => {})
  await db.delete(schema.events).where(eq(schema.events.id, id))
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'event',
    entityId: id,
    entityTitle: row.title,
    metadata: {
      status: row.status,
      slug: row.slug,
      eventDate: row.eventDate?.toISOString?.()
    }
  })
  await purgeSwrCache()
  return { ok: true }
})
