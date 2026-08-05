import { eq } from 'drizzle-orm'

// Backward-compatible endpoint for clients deployed before /api/landing-images.
export default defineEventHandler(async () => {
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, 'historyImage'))
  return { image: decodeManagedImage(rows[0]?.value) }
})
