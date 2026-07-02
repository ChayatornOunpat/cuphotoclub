import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, 'heroImages'))
  const raw = rows[0]?.value
  const images: string[] = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : [])
  return { images }
})
