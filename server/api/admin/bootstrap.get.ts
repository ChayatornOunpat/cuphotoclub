import { count } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const [row] = await db.select({ c: count() }).from(schema.users)
  return { needsBootstrap: row!.c === 0 }
})
