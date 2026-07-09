import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  // Optional so Google-only accounts (no existing password) can set one for the
  // first time. When a password already exists it is required — enforced below.
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(8)
})

// Self-service password change. Any signed-in admin (owner / admin / editor)
// may change their OWN password. Managing other people's passwords stays in
// /api/admin/users/[id] (owner/admin only).
export default defineEventHandler(async (event) => {
  const me = await requireAdmin(event)

  // Throttle brute-force against the current-password check.
  if (!(await rateLimit(`account-password:${me.id}`, 10, 10 * 60 * 1000))) {
    throw createError({ statusCode: 429, message: 'พยายามเปลี่ยนรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ภายหลัง' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร', data: result.error.flatten() })
  }
  const { currentPassword, newPassword } = result.data

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, me.id)).limit(1)
  if (!user || !user.active) throw createError({ statusCode: 401, message: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' })

  const settingPasswordFirstTime = !user.passwordHash

  // If a password is already set, the current one must be supplied and correct.
  if (user.passwordHash) {
    if (!currentPassword) {
      throw createError({ statusCode: 400, message: 'กรุณากรอกรหัสผ่านปัจจุบัน' })
    }
    const valid = await verifyPassword(user.passwordHash, currentPassword)
    if (!valid) throw createError({ statusCode: 401, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' })
  }

  const passwordHash = await hashPassword(newPassword)
  await db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, user.id))

  await recordAdminAudit(
    { id: user.id, email: user.email, name: user.name },
    {
      action: settingPasswordFirstTime ? 'password_set' : 'password_change',
      entityType: 'admin_user',
      entityId: user.id,
      entityTitle: user.email,
      metadata: { self: true }
    }
  )

  return { ok: true }
})
