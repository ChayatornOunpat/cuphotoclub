import { count } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const [{ c }] = await db.select({ c: count() }).from(schema.users)
  return { needsBootstrap: c === 0 }
})
