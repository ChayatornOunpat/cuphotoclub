import { z } from 'zod'

// Contributor manifest — the public twin of
// server/api/admin/upload/sessions/index.post.ts.
//
// Kept as a separate file rather than a `kind` branch inside the admin handler
// on purpose: this is the whole trust boundary, and it should be readable in one
// screen instead of hidden behind an if.
//
// Note there is no `prefix` in the body. The client does not get to say where in
// the bucket it writes.
const bodySchema = z.object({
  files: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    hash: z.string().min(16),
    ext: z.string().optional(),
    size: z.number().nonnegative().max(MAX_UPLOAD_BYTES).optional(),
    type: z.string().optional()
  })).min(1).max(250)
})

// One write per batch of up to 250 files. Rate limiting per *file* would put
// hundreds of writes on the KV free-plan quota that has 500'd the site before.
const MANIFEST_BATCHES = 40
const MANIFEST_WINDOW_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireOpenLink(token)

  if (!(await rateLimit(`contrib-manifest:${clientIp(event)}`, MANIFEST_BATCHES, MANIFEST_WINDOW_MS))) {
    throw createError({ statusCode: 429, message: 'อัปโหลดถี่เกินไป กรุณารอสักครู่' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไฟล์ไม่ถูกต้อง' })

  const contributor = await ensureContributor(event, link)
  if (link.requireName && !contributor.displayName) {
    throw createError({ statusCode: 400, message: 'ลิงก์นี้ต้องระบุชื่อผู้ถ่ายก่อนอัปโหลด' })
  }

  // Friendly early stop. The authoritative cap is re-checked in complete.post —
  // rows only exist after that, so a manifest check alone could be raced by
  // opening several sessions at once.
  const remaining = await remainingForContributor(link, contributor.id)
  if (remaining <= 0) {
    throw createError({ statusCode: 409, message: 'คุณส่งรูปครบตามจำนวนที่กำหนดแล้ว' })
  }
  if (result.data.files.length > remaining) {
    throw createError({
      statusCode: 409,
      message: `ส่งได้อีก ${remaining} รูป (เลือกมา ${result.data.files.length} รูป)`
    })
  }

  const maxBytes = linkMaxBytes(link)
  const prefix = sanitizeUploadPrefix(contributionPrefix(link, contributor.id))
  const items = result.data.files.map((file) => {
    const ext = sanitizeUploadExt(file.ext || file.name.split('.').pop() || 'jpg')
    const hash = sanitizeUploadHash(file.hash)
    const key = hashedUploadKey(prefix, hash, ext)
    if (!key) throw createError({ statusCode: 400, message: 'ข้อมูลไฟล์ไม่ถูกต้อง' })
    if (file.type && !file.type.startsWith('image/')) {
      throw createError({ statusCode: 400, message: 'รองรับเฉพาะไฟล์รูปภาพ' })
    }
    if ((file.size ?? 0) > maxBytes) {
      throw createError({
        statusCode: 413,
        message: `ไฟล์ใหญ่เกิน ${Math.round(maxBytes / (1024 * 1024))}MB`
      })
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
    kind: 'contribution',
    actorId: 0,
    contributorId: contributor.id,
    prefix,
    createdAt: now,
    updatedAt: now,
    items
  }

  try {
    await saveUploadSession(session, event)
  } catch (error) {
    const cause = error instanceof Error ? error.message : String(error)
    console.error('contribution upload session save failed', {
      sessionId: session.id,
      linkId: link.id,
      itemCount: session.items.length,
      cause
    })
    throw createError({ statusCode: 503, message: 'เริ่มการอัปโหลดไม่สำเร็จ กรุณาลองใหม่' })
  }

  return uploadSessionSummary(session)
})
