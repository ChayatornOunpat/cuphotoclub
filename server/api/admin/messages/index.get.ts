import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  // contact_messages is publicly writable (contact form) — cap the inbox read
  // so the table growing unbounded can't blow up this endpoint.
  return db.select().from(schema.contactMessages)
    .orderBy(desc(schema.contactMessages.createdAt))
    .limit(500)
})
