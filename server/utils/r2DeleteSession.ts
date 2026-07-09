import { and, asc, eq, lt } from 'drizzle-orm'

export type R2DeleteSessionItemStatus = 'ready' | 'blocked' | 'deleted' | 'failed'

export interface R2DeleteSessionItem {
  key: string
  status: R2DeleteSessionItemStatus
  referenced: boolean
  error?: string
}

export interface R2DeleteSession {
  id: string
  actorId: number
  force: boolean
  createdAt: string
  updatedAt: string
  items: R2DeleteSessionItem[]
}

const R2_DELETE_SESSION_TTL_MS = 2 * 60 * 60 * 1000

export function r2DeleteSessionKey(id: string) {
  return `admin-r2-delete-session:${id}`
}

export async function getR2DeleteSession(id: string) {
  const [session] = await db
    .select()
    .from(schema.r2DeleteSessions)
    .where(eq(schema.r2DeleteSessions.id, id))
    .limit(1)

  if (!session) return null

  const rows = await db
    .select()
    .from(schema.r2DeleteSessionItems)
    .where(eq(schema.r2DeleteSessionItems.sessionId, id))
    .orderBy(asc(schema.r2DeleteSessionItems.position), asc(schema.r2DeleteSessionItems.key))

  return {
    id: session.id,
    actorId: session.actorId,
    force: session.force,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    items: rows.map(row => ({
      key: row.key,
      status: row.status as R2DeleteSessionItemStatus,
      referenced: row.referenced,
      ...(row.error ? { error: row.error } : {})
    }))
  } satisfies R2DeleteSession
}

export async function saveR2DeleteSession(session: R2DeleteSession) {
  const now = new Date()
  const createdAt = new Date(session.createdAt)
  session.updatedAt = now.toISOString()
  await cleanupExpiredR2DeleteSessions(now)

  await db
    .insert(schema.r2DeleteSessions)
    .values({
      id: session.id,
      actorId: session.actorId,
      force: session.force,
      createdAt: Number.isNaN(createdAt.getTime()) ? now : createdAt,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: schema.r2DeleteSessions.id,
      set: {
        actorId: session.actorId,
        force: session.force,
        updatedAt: now
      }
    })

  await db
    .delete(schema.r2DeleteSessionItems)
    .where(eq(schema.r2DeleteSessionItems.sessionId, session.id))

  if (!session.items.length) return

  const rows = session.items.map((item, position) => ({
    sessionId: session.id,
    key: item.key,
    position,
    status: item.status,
    referenced: item.referenced,
    error: item.error ?? null
  }))

  // D1 caps a query at 100 bound parameters. This table has 6 columns, so we
  // can insert at most floor(100 / 6) = 16 rows per statement.
  const DELETE_ITEM_BATCH = 16
  for (let i = 0; i < rows.length; i += DELETE_ITEM_BATCH) {
    await db.insert(schema.r2DeleteSessionItems).values(rows.slice(i, i + DELETE_ITEM_BATCH))
  }
}

async function cleanupExpiredR2DeleteSessions(now: Date) {
  const cutoff = new Date(now.getTime() - R2_DELETE_SESSION_TTL_MS)
  const expired = await db
    .select({ id: schema.r2DeleteSessions.id })
    .from(schema.r2DeleteSessions)
    .where(lt(schema.r2DeleteSessions.updatedAt, cutoff))
    .limit(50)

  for (const row of expired) {
    await db
      .delete(schema.r2DeleteSessionItems)
      .where(eq(schema.r2DeleteSessionItems.sessionId, row.id))
    await db
      .delete(schema.r2DeleteSessions)
      .where(eq(schema.r2DeleteSessions.id, row.id))
  }
}

export async function saveR2DeleteSessionItems(session: R2DeleteSession, items: R2DeleteSessionItem[]) {
  const now = new Date()
  session.updatedAt = now.toISOString()

  await db
    .update(schema.r2DeleteSessions)
    .set({ updatedAt: now })
    .where(eq(schema.r2DeleteSessions.id, session.id))

  for (const item of items) {
    await db
      .update(schema.r2DeleteSessionItems)
      .set({
        status: item.status,
        referenced: item.referenced,
        error: item.error ?? null
      })
      .where(
        and(
          eq(schema.r2DeleteSessionItems.sessionId, session.id),
          eq(schema.r2DeleteSessionItems.key, item.key)
        )
      )
  }
}

export function r2DeleteSessionSummary(session: R2DeleteSession) {
  return {
    id: session.id,
    force: session.force,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    items: session.items
  }
}
