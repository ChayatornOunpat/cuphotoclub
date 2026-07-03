import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).optional(),
  role: z.enum(['owner', 'admin', 'editor']),
  password: z.string().min(8).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireManageUsers(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  }
  const data = result.data

  // Only an owner may create another owner.
  if (data.role === 'owner' && actor.role !== 'owner') {
    throw createError({ statusCode: 403, message: 'เฉพาะเจ้าของเท่านั้นที่เพิ่มเจ้าของได้' })
  }

  const email = data.email.toLowerCase()
  const [exists] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, email)).limit(1)
  if (exists) {
    throw createError({ statusCode: 409, message: 'อีเมลนี้มีผู้ใช้แล้ว' })
  }

  const passwordHash = data.password ? await hashPassword(data.password) : null

  const [created] = await db
    .insert(schema.users)
    .values({ email, name: data.name ?? null, role: data.role, passwordHash, active: true })
    .returning()

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'admin_user',
    entityId: created.id,
    entityTitle: created.email,
    metadata: {
      role: created.role,
      hasPassword: Boolean(passwordHash)
    }
  })

  const { passwordHash: _ph, googleSub: _gs, ...safe } = created
  return { ...safe, hasPassword: Boolean(passwordHash), googleLinked: false }
})
