import { count, desc } from 'drizzle-orm'

function queryNumber(value: unknown, fallback: number, min: number, max: number) {
  const raw = Array.isArray(value) ? value[0] : value
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, Math.floor(parsed)))
}

export default defineEventHandler(async (event) => {
  await requireManageUsers(event)

  const query = getQuery(event)
  const page = queryNumber(query.page, 1, 1, 10000)
  const pageSize = queryNumber(query.pageSize, 50, 10, 100)
  const offset = (page - 1) * pageSize

  const [logs, [{ total }]] = await Promise.all([
    db
      .select()
      .from(schema.adminAuditLogs)
      .orderBy(desc(schema.adminAuditLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(schema.adminAuditLogs)
  ])

  return {
    logs,
    page,
    pageSize,
    total
  }
})
