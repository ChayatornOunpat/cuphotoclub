import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return db
    .select()
    .from(schema.members)
    .orderBy(asc(schema.members.sortOrder), asc(schema.members.id))
})
