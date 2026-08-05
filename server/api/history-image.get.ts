import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, 'historyImage'))
  return { image: decodeHistoryImage(rows[0]?.value) }
})
