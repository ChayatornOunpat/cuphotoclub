import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  // Throttle brute-force: max 10 attempts per IP per 10 minutes.
  if (!(await rateLimit(`login:${clientIp(event)}`, 10, 10 * 60 * 1000))) {
    throw createError({ statusCode: 429, message: 'พยายามเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const email = result.data.email.toLowerCase()

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1)

  const invalid = createError({ statusCode: 401, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })
  if (!user || !user.active || !user.passwordHash) throw invalid

  const valid = await verifyPassword(user.passwordHash, result.data.password)
  if (!valid) throw invalid

  await db.update(schema.users).set({ lastLoginAt: new Date() }).where(eq(schema.users.id, user.id))
  await recordAdminAudit(
    { id: user.id, email: user.email, name: user.name },
    {
      action: 'login',
      entityType: 'admin_user',
      entityId: user.id,
      entityTitle: user.email,
      metadata: { method: 'password' }
    }
  )

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatarUrl: user.avatarUrl
    }
  })

  return { ok: true }
})
