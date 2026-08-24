// Contributor complete — the public twin of the admin complete route, and the
// authoritative gate for both the per-person cap and the byte ceiling. The
// manifest check is UX; this one is the rule, because a submission row only
// comes into existence here.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  // Deliberately NOT requireOpenLink: by the time this runs the bytes are
  // already in R2. Refusing outright would leave the object behind with no row
  // pointing at it and nothing to ever collect it, so a link that closed
  // mid-batch cleans up after itself instead.
  const link = await requireLink(token)
  const contributor = await requireContributor(event, link)

  const id = getRouterParam(event, 'id') || ''
  const itemId = decodeUploadItemId(getRouterParam(event, 'itemId') || '')
  const session = await getUploadSession(id)

  if (!session) throw createError({ statusCode: 404, message: 'ไม่พบรอบการอัปโหลด' })
  if (session.kind !== 'contribution' || session.contributorId !== contributor.id) {
    throw createError({ statusCode: 403, message: 'รอบการอัปโหลดนี้ไม่ใช่ของคุณ' })
  }
  if (session.prefix !== sanitizeUploadPrefix(contributionPrefix(link, contributor.id))) {
    throw createError({ statusCode: 403, message: 'รอบการอัปโหลดนี้ไม่ตรงกับลิงก์' })
  }

  const item = session.items.find(entry => entry.id === itemId)
  if (!item) throw createError({ statusCode: 404, message: 'ไม่พบไฟล์ในรอบนี้' })

  if (!isLinkOpen(link)) {
    // Only remove it if this contributor has no accepted copy already — the
    // same key can be re-confirmed after a successful upload.
    if (!(await contributorOwnsKey(contributor.id, item.key))) {
      await blob.delete(item.key).catch(() => {})
    }
    item.status = 'failed'
    item.error = 'Link closed before the upload was confirmed.'
    await saveUploadSessionItem(session, item)
    throw createError({ statusCode: 403, message: 'ปิดรับรูปภาพสำหรับลิงก์นี้แล้ว' })
  }

  const maxBytes = linkMaxBytes(link)
  const { blobs } = await blob.list({ prefix: item.key, limit: 1 })
  const uploaded = blobs.find(entry => entry.pathname === item.key)

  if (!uploaded) {
    item.status = 'failed'
    item.error = 'Direct upload did not create the expected R2 object.'
    await saveUploadSessionItem(session, item)
    throw createError({ statusCode: 409, message: 'อัปโหลดไม่สำเร็จ กรุณาลองใหม่' })
  }
  if (!uploaded.contentType?.startsWith('image/')) {
    await blob.delete(item.key).catch(() => {})
    item.status = 'failed'
    item.error = 'Uploaded object is not an image.'
    await saveUploadSessionItem(session, item)
    throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
  }
  // Read the real size back rather than trusting the manifest — this is what
  // makes the admin's byte limit a rule instead of a request, since compression
  // itself runs in the browser and can be bypassed.
  if ((uploaded.size || 0) > maxBytes) {
    await blob.delete(item.key).catch(() => {})
    item.status = 'failed'
    item.error = 'Uploaded object is too large.'
    await saveUploadSessionItem(session, item)
    throw createError({
      statusCode: 413,
      message: `ไฟล์ใหญ่เกิน ${Math.round(maxBytes / (1024 * 1024))}MB`
    })
  }
  if (uploaded.customMetadata?.hash !== item.hash) {
    await blob.delete(item.key).catch(() => {})
    item.status = 'failed'
    item.error = 'Uploaded object hash metadata did not match the manifest.'
    await saveUploadSessionItem(session, item)
    throw createError({ statusCode: 400, message: 'ไฟล์ไม่ตรงกับข้อมูลที่ส่งมา' })
  }

  // The real cap. Duplicates of a photo this person already sent are not new
  // rows (unique index on contributor + key), so they must not be refused here —
  // only genuinely new photos count against the limit.
  const alreadyMine = await contributorOwnsKey(contributor.id, item.key)
  if (!alreadyMine && (await remainingForContributor(link, contributor.id)) <= 0) {
    item.status = 'failed'
    item.error = 'Contributor limit reached.'
    await saveUploadSessionItem(session, item)
    throw createError({ statusCode: 409, message: 'คุณส่งรูปครบตามจำนวนที่กำหนดแล้ว' })
  }

  await db
    .insert(schema.collectionSubmissions)
    .values({
      id: crypto.randomUUID(),
      linkId: link.id,
      contributorId: contributor.id,
      r2Key: item.key,
      hash: item.hash,
      size: uploaded.size || item.size,
      type: uploaded.contentType || item.type
    })
    .onConflictDoNothing()

  item.status = 'uploaded'
  item.error = undefined
  await saveUploadSessionItem(session, item)

  return { key: item.key, status: item.status }
})
