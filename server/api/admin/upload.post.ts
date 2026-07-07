const MAX_BYTES = 15 * 1024 * 1024

// Generic single-image upload → returns { key }. Used for post/event cover images.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const form = await readMultipartFormData(event)
  const file = form?.find(p => p.name === 'file' && p.filename)
  if (!file) throw createError({ statusCode: 400, message: 'ไม่พบไฟล์' })

  const type = file.type || ''
  if (!type.startsWith('image/')) throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
  if (file.data.length > MAX_BYTES) throw createError({ statusCode: 413, message: 'ไฟล์ใหญ่เกิน 15MB' })

  const prefix = sanitizeUploadPrefix(form?.find(p => p.name === 'prefix')?.data?.toString() || 'covers')
  const ext = sanitizeUploadExt(file.filename?.split('.').pop() || 'jpg')
  const contentHash = sanitizeUploadHash(form?.find(p => p.name === 'hash')?.data?.toString() || '')
  const key = `${prefix}/${contentHash || crypto.randomUUID()}.${ext}`

  // Client queue-order stamp (epoch ms) used to sort listings in the order the
  // user queued the files. Ignore it when it disagrees wildly with our clock.
  const seqNum = Number(form?.find(p => p.name === 'seq')?.data?.toString() || '')
  const seq = Number.isFinite(seqNum) && Math.abs(seqNum - Date.now()) < 86_400_000
    ? String(Math.trunc(seqNum))
    : ''

  if (contentHash) {
    const { blobs } = await blob.list({ prefix: key, limit: 1 })
    if (blobs.some(item => item.pathname === key)) return { key, duplicate: true }
  }

  await blob.put(key, file.data, { contentType: type, ...(seq ? { customMetadata: { seq } } : {}) })
  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'media',
    entityId: key,
    entityTitle: file.filename ?? key,
    metadata: {
      prefix,
      contentType: type,
      size: file.data.length
    }
  })
  return { key }
})
