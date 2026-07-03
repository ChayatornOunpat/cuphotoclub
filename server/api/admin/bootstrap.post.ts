import { count } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).optional(),
  password: z.string().min(8)
})

export default defineEventHandler(async (event) => {
  if (!(await rateLimit(`bootstrap:${clientIp(event)}`, 5, 10 * 60 * 1000))) {
    throw createError({ statusCode: 429, message: 'พยายามสร้างบัญชีบ่อยเกินไป กรุณาลองใหม่ภายหลัง' })
  }

  const [{ c }] = await db.select({ c: count() }).from(schema.users)
  if (c > 0) {
    throw createError({ statusCode: 403, message: 'ระบบมีบัญชีผู้ดูแลแล้ว กรุณาเข้าสู่ระบบด้วยบัญชีเดิม' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  }

  const email = result.data.email.toLowerCase()
  const passwordHash = await hashPassword(result.data.password)
  const [created] = await db
    .insert(schema.users)
    .values({
      email,
      name: result.data.name ?? 'Owner',
      role: 'owner',
      passwordHash,
      active: true
    })
    .returning()

  await recordAdminAudit(
    { id: created.id, email: created.email, name: created.name },
    {
      action: 'bootstrap',
      entityType: 'admin_user',
      entityId: created.id,
      entityTitle: created.email,
      metadata: { role: created.role }
    }
  )

  await setUserSession(event, {
    user: {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      avatarUrl: created.avatarUrl
    }
  })

  return { ok: true }
})
