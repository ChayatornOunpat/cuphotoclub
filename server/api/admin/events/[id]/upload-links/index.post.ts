import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  label: z.string().trim().max(200).optional(),
  requireName: z.boolean().optional(),
  maxPerContributor: z.number().int().min(1).max(1000).optional(),
  maxTotal: z.number().int().min(1).max(20000).optional(),
  compress: z.boolean().optional(),
  compressMaxDim: z.number().int().min(480).max(8000).optional(),
  compressQuality: z.number().int().min(40).max(100).optional(),
  maxBytesPerPhoto: z.number().int().min(256 * 1024).max(MAX_UPLOAD_BYTES).optional(),
  expiresAt: z.string().datetime().nullable().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [ev] = await db
    .select({ id: schema.events.id, title: schema.events.title })
    .from(schema.events)
    .where(eq(schema.events.id, id))
    .limit(1)
  if (!ev) throw createError({ statusCode: 404, message: 'ไม่พบกิจกรรม' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const input = result.data

  // "Original" (no compression) plus a tight byte ceiling is a link where every
  // upload fails. Refuse it here rather than letting an event discover it live.
  if (input.compress === false && (input.maxBytesPerPhoto ?? MAX_UPLOAD_BYTES) < MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 400,
      message: 'Turning compression off requires the per-photo limit to stay at the maximum.'
    })
  }

  const [created] = await db
    .insert(schema.eventUploadLinks)
    .values({
      id: generateLinkToken(),
      eventId: id,
      label: input.label || ev.title,
      requireName: input.requireName ?? false,
      maxPerContributor: input.maxPerContributor ?? 100,
      maxTotal: input.maxTotal ?? 2000,
      compress: input.compress ?? true,
      compressMaxDim: input.compressMaxDim ?? 3040,
      compressQuality: input.compressQuality ?? 85,
      maxBytesPerPhoto: input.maxBytesPerPhoto ?? MAX_UPLOAD_BYTES,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      createdBy: actor.id
    })
    .returning()

  if (!created) throw createError({ statusCode: 500, message: 'สร้างลิงก์ไม่สำเร็จ' })

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'event_upload_link',
    entityId: created.id,
    entityTitle: created.label,
    metadata: { eventId: id, eventTitle: ev.title }
  })

  return { ...created, open: isLinkOpen(created), photoCount: 0, contributorCount: 0 }
})
