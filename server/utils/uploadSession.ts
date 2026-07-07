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

const UPLOAD_SESSION_TTL = 6 * 60 * 60

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
  return await kv.get<UploadSession>(uploadSessionKey(id))
}

export async function saveUploadSession(session: UploadSession) {
  session.updatedAt = new Date().toISOString()
  await kv.set(uploadSessionKey(session.id), session, { ttl: UPLOAD_SESSION_TTL })
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
