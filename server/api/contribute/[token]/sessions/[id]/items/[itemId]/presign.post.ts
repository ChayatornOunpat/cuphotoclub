import { z } from 'zod'

const bodySchema = z.object({
  seq: z.number().optional()
})

// Contributor presign — the public twin of the admin presign route. The only
// structural difference is the guard: this checks contributorId and refuses any
// session that is not a contribution, so the two identities can never cross.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireOpenLink(token)
  const contributor = await requireContributor(event, link)

  const id = getRouterParam(event, 'id') || ''
  const itemId = decodeUploadItemId(getRouterParam(event, 'itemId') || '')
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })

  const session = await getUploadSession(id)
  if (!session) throw createError({ statusCode: 404, message: 'ไม่พบรอบการอัปโหลด' })
  if (session.kind !== 'contribution' || session.contributorId !== contributor.id) {
    throw createError({ statusCode: 403, message: 'รอบการอัปโหลดนี้ไม่ใช่ของคุณ' })
  }
  // A session is bound to the prefix of the link it was opened on, so it cannot
  // be replayed against a different event's link.
  if (session.prefix !== sanitizeUploadPrefix(contributionPrefix(link, contributor.id))) {
    throw createError({ statusCode: 403, message: 'รอบการอัปโหลดนี้ไม่ตรงกับลิงก์' })
  }

  const item = session.items.find(entry => entry.id === itemId)
  if (!item) throw createError({ statusCode: 404, message: 'ไม่พบไฟล์ในรอบนี้' })
  if (item.status === 'exists' || item.status === 'uploaded') {
    return { key: item.key, status: item.status, duplicate: item.status === 'exists' }
  }

  const maxBytes = linkMaxBytes(link)
  if (item.size > maxBytes) {
    item.status = 'failed'
    item.error = 'File too large.'
    await saveUploadSessionItem(session, item)
    throw createError({
      statusCode: 413,
      message: `ไฟล์ใหญ่เกิน ${Math.round(maxBytes / (1024 * 1024))}MB`
    })
  }

  const type = item.type || 'image/jpeg'
  if (!type.startsWith('image/')) throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })

  const seq = Number.isFinite(result.data.seq) && Math.abs((result.data.seq ?? 0) - Date.now()) < 86_400_000
    ? String(Math.trunc(result.data.seq ?? 0))
    : ''

  // Content-addressed keys: if this exact photo is already in the pool (someone
  // else sent it, or this person is re-dropping a folder) there is nothing to
  // upload. complete.post still records their own submission row for it.
  const { blobs } = await blob.list({ prefix: item.key, limit: 1 })
  if (blobs.some(entry => entry.pathname === item.key)) {
    item.status = 'exists'
    item.error = undefined
    await saveUploadSessionItem(session, item)
    return { key: item.key, status: item.status, duplicate: true }
  }

  const directConfig = assertR2DirectUploadConfig()
  if (item.status === 'failed') {
    item.status = 'pending'
    item.error = undefined
    await saveUploadSessionItem(session, item)
  }
  const signed = await createR2PresignedPutUrl({
    ...directConfig,
    key: item.key,
    contentType: type,
    // Binds the PUT to exactly the manifested size. Without this the URL would
    // accept anything up to R2's own 5 GB ceiling, repeatedly, until it expired
    // — and linkMaxBytes would only notice afterwards, in complete.
    contentLength: item.size,
    expiresSeconds: 300,
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
