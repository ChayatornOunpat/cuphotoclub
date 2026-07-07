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

const R2_DELETE_SESSION_TTL = 2 * 60 * 60

export function r2DeleteSessionKey(id: string) {
  return `admin-r2-delete-session:${id}`
}

export async function getR2DeleteSession(id: string) {
  return await kv.get<R2DeleteSession>(r2DeleteSessionKey(id))
}

export async function saveR2DeleteSession(session: R2DeleteSession) {
  session.updatedAt = new Date().toISOString()
  await kv.set(r2DeleteSessionKey(session.id), session, { ttl: R2_DELETE_SESSION_TTL })
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
