import { and, count, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().trim().min(1).nullable().optional(),
  role: z.enum(['owner', 'admin', 'editor']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireManageUsers(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  }
  const data = result.data

  const [target] = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1)
  if (!target) throw createError({ statusCode: 404, message: 'ไม่พบผู้ใช้' })

  // Only an owner may modify owner accounts or grant the owner role.
  if ((target.role === 'owner' || data.role === 'owner') && actor.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'เฉพาะเจ้าของเท่านั้นที่จัดการบัญชีเจ้าของได้' })
  }

  // Never strip the last active owner.
  const demotingOwner = target.role === 'owner' && ((data.role && data.role !== 'owner') || data.active === false)
  if (demotingOwner) {
    const [{ c }] = await db
      .select({ c: count() })
      .from(schema.users)
      .where(and(eq(schema.users.role, 'owner'), eq(schema.users.active, true)))
    if (c <= 1) throw createError({ statusCode: 400, message: 'ต้องมีเจ้าของที่ใช้งานอยู่อย่างน้อยหนึ่งคน' })
  }

  const updates: Record<string, unknown> = {}
  if (data.name !== undefined) updates.name = data.name
  if (data.role !== undefined) updates.role = data.role
  if (data.active !== undefined) updates.active = data.active
  if (data.password) updates.passwordHash = await hashPassword(data.password)

  if (Object.keys(updates).length) {
    await db.update(schema.users).set(updates).where(eq(schema.users.id, id))
    await recordAdminAudit(actor, {
      action: 'update',
      entityType: 'admin_user',
      entityId: target.id,
      entityTitle: target.email,
      metadata: {
        changed: Object.keys(updates).map(key => key === 'passwordHash' ? 'password' : key),
        previousRole: target.role,
        nextRole: data.role ?? target.role,
        previousActive: target.active,
        nextActive: data.active ?? target.active
      }
    })
  }
  return { ok: true }
})
