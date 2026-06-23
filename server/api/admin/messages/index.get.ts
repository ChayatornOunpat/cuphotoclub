import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return db.select().from(schema.contactMessages).orderBy(desc(schema.contactMessages.createdAt))
})
