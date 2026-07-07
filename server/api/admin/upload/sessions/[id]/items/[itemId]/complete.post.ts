export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const itemId = decodeUploadItemId(getRouterParam(event, 'itemId') || '')
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

  const { blobs } = await blob.list({ prefix: item.key, limit: 1 })
  const uploaded = blobs.find(entry => entry.pathname === item.key)
  if (!uploaded) {
    item.status = 'failed'
    item.error = 'Direct upload did not create the expected R2 object.'
    await saveUploadSession(session)
    throw createError({ statusCode: 409, message: item.error })
  }

  item.status = 'uploaded'
  item.error = undefined
  await saveUploadSession(session)

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'media',
    entityId: item.key,
    entityTitle: item.name,
    metadata: {
      prefix: session.prefix,
      contentType: uploaded.contentType || item.type,
      size: uploaded.size || item.size,
      sessionId: session.id,
      itemId: item.id,
      direct: true
    }
  })

  return { key: item.key, status: item.status }
})
