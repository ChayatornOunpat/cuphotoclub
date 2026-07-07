import { z } from 'zod'

const bodySchema = z.object({
  prefix: z.string().optional(),
  files: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    hash: z.string().min(16),
    ext: z.string().optional(),
    size: z.number().nonnegative().optional(),
    type: z.string().optional()
  })).min(1).max(250)
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid upload session payload.' })

  const prefix = sanitizeUploadPrefix(result.data.prefix || 'covers')
  const items = await Promise.all(result.data.files.map(async (file) => {
    const ext = sanitizeUploadExt(file.ext || file.name.split('.').pop() || 'jpg')
    const hash = sanitizeUploadHash(file.hash)
    const key = hashedUploadKey(prefix, hash, ext)
    if (!key) throw createError({ statusCode: 400, message: 'Invalid upload hash.' })

    const { blobs } = await blob.list({ prefix: key, limit: 1 })
    const exists = blobs.some(item => item.pathname === key)
    return {
      id: file.id,
      name: file.name,
      hash,
      ext,
      key,
      size: file.size ?? 0,
      type: file.type || 'image/jpeg',
      status: exists ? 'exists' as const : 'pending' as const
    }
  }))

  const now = new Date().toISOString()
  const session: UploadSession = {
    id: crypto.randomUUID(),
    actorId: actor.id,
    prefix,
    createdAt: now,
    updatedAt: now,
    items
  }
  await saveUploadSession(session)

  return uploadSessionSummary(session)
})
