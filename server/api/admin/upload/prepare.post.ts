import { z } from 'zod'

const bodySchema = z.object({
  prefix: z.string().optional(),
  files: z.array(z.object({
    id: z.string().min(1),
    hash: z.string().min(16),
    ext: z.string().optional()
  })).min(1).max(20)
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid upload prepare payload.' })

  const items = await Promise.all(result.data.files.map(async (file) => {
    const key = hashedUploadKey(result.data.prefix || 'covers', file.hash, file.ext || 'jpg')
    if (!key) return { id: file.id, key: '', exists: false, valid: false }

    const { blobs } = await blob.list({ prefix: key, limit: 1 })
    return {
      id: file.id,
      key,
      exists: blobs.some(item => item.pathname === key),
      valid: true
    }
  }))

  return { items }
})
