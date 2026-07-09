import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  password: z.string().min(1)
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  if (!(await rateLimit(`admin-password-gate:${actor.id}:${clientIp(event)}`, 8, 10 * 60 * 1000))) {
    throw createError({ statusCode: 429, message: 'Too many password attempts. Try again later.' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Password is required.' })

  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, actor.id)).limit(1)
  if (!user || !user.active || !user.passwordHash) {
    throw createError({ statusCode: 403, message: 'This admin account does not have a password login configured.' })
  }

  const valid = await verifyPassword(user.passwordHash, result.data.password)
  if (!valid) throw createError({ statusCode: 401, message: 'Incorrect admin password.' })

  return { ok: true }
})
