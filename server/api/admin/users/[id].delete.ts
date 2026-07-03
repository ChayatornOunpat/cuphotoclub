import { and, count, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireManageUsers(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })
  if (id === actor.id) throw createError({ statusCode: 400, message: 'ลบบัญชีของตัวเองไม่ได้' })

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'ไม่พบผู้ใช้' })

  if (target.role === 'owner' && actor.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'เฉพาะเจ้าของเท่านั้นที่ลบบัญชีเจ้าของได้' })
  }
  if (target.role === 'owner') {
    const [{ c }] = await db
      .select({ c: count() })
      .from(schema.users)
      .where(and(eq(schema.users.role, 'owner'), eq(schema.users.active, true)))
    if (c <= 1) throw createError({ statusCode: 400, message: 'ต้องมีเจ้าของที่ใช้งานอยู่อย่างน้อยหนึ่งคน' })
  }

  await db.delete(schema.users).where(eq(schema.users.id, id))
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'admin_user',
    entityId: target.id,
    entityTitle: target.email,
    metadata: {
      role: target.role,
      active: target.active
    }
  })
  return { ok: true }
})
