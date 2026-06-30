import { asc, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return db
    .select()
    .from(schema.members)
    .orderBy(asc(schema.members.schoolYear), asc(schema.members.sortOrder), asc(schema.members.createdAt))
})
