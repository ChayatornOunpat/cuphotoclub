import { eq } from 'drizzle-orm'

// Returns the signed-in user's own profile. Available to every authenticated
// admin (owner / admin / editor) — this is self-service, not user management.
export default defineEventHandler(async (event) => {
  const me = await requireAdmin(event)

  const [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, me.id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบบัญชีผู้ใช้' })

  // Never leak the hash or the OAuth subject; expose booleans instead.
  const { passwordHash, googleSub, ...safe } = row
  return {
    ...safe,
    hasPassword: Boolean(passwordHash),
    googleLinked: Boolean(googleSub)
  }
})
