import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, 'clubroomImage'))
  return { image: decodeManagedImage(rows[0]?.value) }
})
