import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireManageUsers(event)

  return db
    .select()
    .from(schema.adminAuditLogs)
    .orderBy(desc(schema.adminAuditLogs.createdAt))
    .limit(200)
})
