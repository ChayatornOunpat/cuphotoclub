import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
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

// Change a link's policy, or close it. Closing is the switch that ends both
// uploading and contributor editing — it is the whole permission model.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const linkId = getRouterParam(event, 'linkId') || ''
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const input = result.data

  const [existing] = await db
    .select()
    .from(schema.eventUploadLinks)
    .where(and(
      eq(schema.eventUploadLinks.id, linkId),
      eq(schema.eventUploadLinks.eventId, id)
    ))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์อัปโหลด' })

  const compress = input.compress ?? existing.compress
  const maxBytes = input.maxBytesPerPhoto ?? existing.maxBytesPerPhoto
  if (!compress && maxBytes < MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 400,
      message: 'Turning compression off requires the per-photo limit to stay at the maximum.'
    })
  }

  const [updated] = await db
    .update(schema.eventUploadLinks)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.requireName !== undefined ? { requireName: input.requireName } : {}),
      ...(input.maxPerContributor !== undefined ? { maxPerContributor: input.maxPerContributor } : {}),
      ...(input.maxTotal !== undefined ? { maxTotal: input.maxTotal } : {}),
      ...(input.compress !== undefined ? { compress: input.compress } : {}),
      ...(input.compressMaxDim !== undefined ? { compressMaxDim: input.compressMaxDim } : {}),
      ...(input.compressQuality !== undefined ? { compressQuality: input.compressQuality } : {}),
      ...(input.maxBytesPerPhoto !== undefined ? { maxBytesPerPhoto: input.maxBytesPerPhoto } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null } : {}),
      updatedAt: new Date()
    })
    .where(eq(schema.eventUploadLinks.id, linkId))
    .returning()

  if (!updated) throw createError({ statusCode: 500, message: 'บันทึกไม่สำเร็จ' })

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'event_upload_link',
    entityId: updated.id,
    entityTitle: updated.label,
    metadata: { eventId: id, ...input }
  })

  return { ...updated, open: isLinkOpen(updated) }
})
