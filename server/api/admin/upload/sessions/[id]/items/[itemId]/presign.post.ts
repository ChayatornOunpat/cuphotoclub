import { z } from 'zod'

const bodySchema = z.object({
  seq: z.number().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const itemId = decodeUploadItemId(getRouterParam(event, 'itemId') || '')
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid presign payload.' })

  const session = await getUploadSession(id)
  if (!session) throw createError({ statusCode: 404, message: 'Upload session not found.' })
  if (session.actorId !== actor.id) {
    throw createError({ statusCode: 403, message: 'This upload session belongs to another admin.' })
  }

  const item = session.items.find(entry => entry.id === itemId)
  if (!item) throw createError({ statusCode: 404, message: 'Upload item not found.' })
  if (item.status === 'exists' || item.status === 'uploaded') {
    return { key: item.key, status: item.status, duplicate: item.status === 'exists' }
  }

  const type = item.type || 'image/jpeg'
  if (!type.startsWith('image/')) throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })

  const seq = Number.isFinite(result.data.seq) && Math.abs((result.data.seq ?? 0) - Date.now()) < 86_400_000
    ? String(Math.trunc(result.data.seq ?? 0))
    : ''

  const { blobs } = await blob.list({ prefix: item.key, limit: 1 })
  if (blobs.some(entry => entry.pathname === item.key)) {
    item.status = 'exists'
    item.error = undefined
    await saveUploadSession(session)
    return { key: item.key, status: item.status, duplicate: true }
  }

  const directConfig = assertR2DirectUploadConfig()
  const signed = await createR2PresignedPutUrl({
    ...directConfig,
    key: item.key,
    contentType: type,
    metadata: {
      hash: item.hash,
      ...(seq ? { seq } : {})
    }
  })

  return {
    key: item.key,
    status: item.status,
    upload: signed
  }
})
