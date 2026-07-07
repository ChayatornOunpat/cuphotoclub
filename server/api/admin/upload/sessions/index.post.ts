import { z } from 'zod'

const bodySchema = z.object({
  prefix: z.string().optional(),
  files: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    hash: z.string().min(16),
    ext: z.string().optional(),
    size: z.number().nonnegative().max(MAX_UPLOAD_BYTES).optional(),
    type: z.string().optional()
  })).min(1).max(250)
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid upload session payload.' })

  const prefix = sanitizeUploadPrefix(result.data.prefix || 'covers')
  const items = result.data.files.map((file) => {
    const ext = sanitizeUploadExt(file.ext || file.name.split('.').pop() || 'jpg')
    const hash = sanitizeUploadHash(file.hash)
    const key = hashedUploadKey(prefix, hash, ext)
    if (!key) throw createError({ statusCode: 400, message: 'Invalid upload hash.' })
    if (file.type && !file.type.startsWith('image/')) {
      throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
    }
    return {
      id: file.id,
      name: file.name,
      hash,
      ext,
      key,
      size: file.size ?? 0,
      type: file.type || 'image/jpeg',
      status: 'pending' as const
    }
  })

  const now = new Date().toISOString()
  const session: UploadSession = {
    id: crypto.randomUUID(),
    actorId: actor.id,
    prefix,
    createdAt: now,
    updatedAt: now,
    items
  }
  try {
    await saveUploadSession(session)
  } catch {
    throw createError({
      statusCode: 503,
      message: 'Could not create upload session. KV storage is unavailable or misconfigured.'
    })
  }

  return uploadSessionSummary(session)
})
