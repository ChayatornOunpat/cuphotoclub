import { z } from 'zod'

const bodySchema = z.object({
  prefix: z.string().optional(),
  hash: z.string().min(16),
  ext: z.string().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid upload check payload.' })

  const key = hashedUploadKey(
    result.data.prefix || 'covers',
    result.data.hash,
    result.data.ext || 'jpg'
  )
  if (!key) throw createError({ statusCode: 400, message: 'Invalid upload hash.' })

  const { blobs } = await blob.list({ prefix: key, limit: 1 })
  return {
    key,
    exists: blobs.some(item => item.pathname === key)
  }
})
