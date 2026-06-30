import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [row] = await db.select({ photoR2Key: schema.members.photoR2Key }).from(schema.members).where(eq(schema.members.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบสมาชิก' })

  if (row.photoR2Key) await blob.delete(row.photoR2Key).catch(() => {})
  await db.delete(schema.members).where(eq(schema.members.id, id))
  return { ok: true }
})
