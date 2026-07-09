import { and, asc, eq, lt } from 'drizzle-orm'

export type UploadSessionItemStatus = 'pending' | 'exists' | 'uploaded' | 'failed'

export interface UploadSessionItem {
  id: string
  name: string
  hash: string
  ext: string
  key: string
  size: number
  type: string
  status: UploadSessionItemStatus
  error?: string
}

export interface UploadSession {
  id: string
  actorId: number
  prefix: string
  createdAt: string
  updatedAt: string
  items: UploadSessionItem[]
}

const UPLOAD_SESSION_TTL_MS = 6 * 60 * 60 * 1000

export function uploadSessionKey(id: string) {
  return `admin-upload-session:${id}`
}

export function decodeUploadItemId(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export async function mapUploadSessionItems<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
) {
  const results = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(Math.max(concurrency, 1), items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await worker(items[index], index)
    }
  })

  await Promise.all(workers)
  return results
}

export async function getUploadSession(id: string) {
  const [session] = await db
    .select()
    .from(schema.uploadSessions)
    .where(eq(schema.uploadSessions.id, id))
    .limit(1)

  if (!session) return null

  const rows = await db
    .select()
    .from(schema.uploadSessionItems)
    .where(eq(schema.uploadSessionItems.sessionId, id))
    .orderBy(asc(schema.uploadSessionItems.position), asc(schema.uploadSessionItems.id))

  return {
    id: session.id,
    actorId: session.actorId,
    prefix: session.prefix,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    items: rows.map(row => ({
      id: row.id,
      name: row.name,
      hash: row.hash,
      ext: row.ext,
      key: row.r2Key,
      size: row.size,
      type: row.type,
      status: row.status as UploadSessionItemStatus,
      ...(row.error ? { error: row.error } : {})
    }))
  } satisfies UploadSession
}

export async function saveUploadSession(session: UploadSession) {
  const now = new Date()
  const createdAt = new Date(session.createdAt)
  session.updatedAt = now.toISOString()
  await cleanupExpiredUploadSessions(now)

  await db
    .insert(schema.uploadSessions)
    .values({
      id: session.id,
      actorId: session.actorId,
      prefix: session.prefix,
      createdAt: Number.isNaN(createdAt.getTime()) ? now : createdAt,
      updatedAt: now
    })
    .onConflictDoUpdate({
      target: schema.uploadSessions.id,
      set: {
        actorId: session.actorId,
        prefix: session.prefix,
        updatedAt: now
      }
    })

  await db
    .delete(schema.uploadSessionItems)
    .where(eq(schema.uploadSessionItems.sessionId, session.id))

  if (!session.items.length) return

  const rows = session.items.map((item, position) => ({
    sessionId: session.id,
    id: item.id,
    position,
    name: item.name,
    hash: item.hash,
    ext: item.ext,
    r2Key: item.key,
    size: item.size,
    type: item.type,
    status: item.status,
    error: item.error ?? null
  }))

  // D1 caps a query at 100 bound parameters. This table has 11 columns, so we
  // can insert at most floor(100 / 11) = 9 rows per statement.
  const UPLOAD_ITEM_BATCH = 9
  for (let i = 0; i < rows.length; i += UPLOAD_ITEM_BATCH) {
    await db.insert(schema.uploadSessionItems).values(rows.slice(i, i + UPLOAD_ITEM_BATCH))
  }
}

async function cleanupExpiredUploadSessions(now: Date) {
  const cutoff = new Date(now.getTime() - UPLOAD_SESSION_TTL_MS)
  const expired = await db
    .select({ id: schema.uploadSessions.id })
    .from(schema.uploadSessions)
    .where(lt(schema.uploadSessions.updatedAt, cutoff))
    .limit(50)

  for (const row of expired) {
    await db
      .delete(schema.uploadSessionItems)
      .where(eq(schema.uploadSessionItems.sessionId, row.id))
    await db
      .delete(schema.uploadSessions)
      .where(eq(schema.uploadSessions.id, row.id))
  }
}

export async function saveUploadSessionItem(session: UploadSession, item: UploadSessionItem) {
  const now = new Date()
  session.updatedAt = now.toISOString()

  await db
    .update(schema.uploadSessions)
    .set({ updatedAt: now })
    .where(eq(schema.uploadSessions.id, session.id))

  await db
    .update(schema.uploadSessionItems)
    .set({
      name: item.name,
      hash: item.hash,
      ext: item.ext,
      r2Key: item.key,
      size: item.size,
      type: item.type,
      status: item.status,
      error: item.error ?? null
    })
    .where(
      and(
        eq(schema.uploadSessionItems.sessionId, session.id),
        eq(schema.uploadSessionItems.id, item.id)
      )
    )
}

export function uploadSessionSummary(session: UploadSession) {
  return {
    id: session.id,
    prefix: session.prefix,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    items: session.items
  }
}
