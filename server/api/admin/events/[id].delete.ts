import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [row] = await db.select({ coverR2Key: schema.events.coverR2Key }).from(schema.events).where(eq(schema.events.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบกิจกรรม' })

  if (row.coverR2Key) await blob.delete(row.coverR2Key).catch(() => {})
  await db.delete(schema.events).where(eq(schema.events.id, id))
  return { ok: true }
})
