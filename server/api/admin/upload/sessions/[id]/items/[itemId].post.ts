const MAX_BYTES = 15 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const itemId = decodeUploadItemId(getRouterParam(event, 'itemId') || '')
  const session = await getUploadSession(id)

  if (!session) {
    throw createError({ statusCode: 404, message: 'Upload session not found.' })
  }
  if (session.actorId !== actor.id) {
    throw createError({ statusCode: 403, message: 'This upload session belongs to another admin.' })
  }

  const item = session.items.find(entry => entry.id === itemId)
  if (!item) {
    throw createError({ statusCode: 404, message: 'Upload item not found.' })
  }
  if (item.status === 'exists' || item.status === 'uploaded') {
    return { key: item.key, status: item.status, duplicate: item.status === 'exists' }
  }

  const form = await readMultipartFormData(event)
  const file = form?.find(part => part.name === 'file' && part.filename)
  if (!file) {
    item.status = 'failed'
    item.error = 'Missing file.'
    await saveUploadSession(session)
    throw createError({ statusCode: 400, message: 'ไม่พบไฟล์' })
  }

  const type = file.type || item.type || ''
  if (!type.startsWith('image/')) {
    item.status = 'failed'
    item.error = 'Unsupported file type.'
    await saveUploadSession(session)
    throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
  }
  if (file.data.length > MAX_BYTES) {
    item.status = 'failed'
    item.error = 'File too large.'
    await saveUploadSession(session)
    throw createError({ statusCode: 413, message: 'ไฟล์ใหญ่เกิน 15MB' })
  }

  const contentHash = sanitizeUploadHash(form?.find(part => part.name === 'hash')?.data?.toString() || '')
  if (!contentHash || contentHash !== item.hash) {
    item.status = 'failed'
    item.error = 'Upload hash did not match the manifest.'
    await saveUploadSession(session)
    throw createError({ statusCode: 400, message: 'Upload hash did not match the manifest.' })
  }

  const seqNum = Number(form?.find(part => part.name === 'seq')?.data?.toString() || '')
  const seq = Number.isFinite(seqNum) && Math.abs(seqNum - Date.now()) < 86_400_000
    ? String(Math.trunc(seqNum))
    : ''

  const { blobs } = await blob.list({ prefix: item.key, limit: 1 })
  if (blobs.some(entry => entry.pathname === item.key)) {
    item.status = 'exists'
    item.error = undefined
    await saveUploadSession(session)
    return { key: item.key, status: item.status, duplicate: true }
  }

  await blob.put(item.key, file.data, { contentType: type, ...(seq ? { customMetadata: { seq } } : {}) })
  item.status = 'uploaded'
  item.error = undefined
  await saveUploadSession(session)

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'media',
    entityId: item.key,
    entityTitle: file.filename ?? item.name,
    metadata: {
      prefix: session.prefix,
      contentType: type,
      size: file.data.length,
      sessionId: session.id,
      itemId: item.id
    }
  })

  return { key: item.key, status: item.status }
})
