import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  status: z.enum(['open', 'closed']).optional(),
  label: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  coverR2Key: z.string().nullable().optional(),
  // The album approved photos land in. null unlinks; the next approval then
  // creates a fresh draft. Validated below — a bad id would dangle silently.
  albumId: z.string().min(1).nullable().optional(),
  eventDate: z.string().nullable().optional(),
  location: z.string().trim().max(200).nullable().optional(),
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
  const linkId = getRouterParam(event, 'linkId') || ''

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const input = result.data

  const [existing] = await db
    .select()
    .from(schema.collectionLinks)
    .where(eq(schema.collectionLinks.id, linkId))
    .limit(1)
  if (!existing) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์รวมรูป' })

  const compress = input.compress ?? existing.compress
  const maxBytes = input.maxBytesPerPhoto ?? existing.maxBytesPerPhoto
  if (!compress && maxBytes < MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 400,
      message: 'Turning compression off requires the per-photo limit to stay at the maximum.'
    })
  }

  // Reject an album id that does not resolve rather than storing a dangling one.
  if (input.albumId) {
    const target = await albumStore.get(input.albumId)
    if (!target) throw createError({ statusCode: 404, message: 'Album not found.' })
  }

  const [updated] = await db
    .update(schema.collectionLinks)
    .set({
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.label !== undefined ? { label: input.label } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.coverR2Key !== undefined ? { coverR2Key: input.coverR2Key } : {}),
      ...(input.albumId !== undefined ? { albumId: input.albumId } : {}),
      ...(input.eventDate !== undefined ? { eventDate: input.eventDate ? new Date(input.eventDate) : null } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
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
    .where(eq(schema.collectionLinks.id, linkId))
    .returning()

  if (!updated) throw createError({ statusCode: 500, message: 'บันทึกไม่สำเร็จ' })

  // Replacing or clearing the cover leaves the old object with nothing pointing
  // at it. Delete after the row is committed, so a failed write never orphans
  // the image that is still in use. Same order as the events cover.
  if (input.coverR2Key !== undefined && existing.coverR2Key && existing.coverR2Key !== input.coverR2Key) {
    await blob.delete(existing.coverR2Key).catch(() => {})
  }

  // Photos already approved were copied into the previous album's folder.
  // Point their keys at the new album so the pool reports them as missing from
  // it, and "Re-add to album" copies them across — rather than leaving the new
  // album referencing images that live under the old album's id.
  if (input.albumId !== undefined && input.albumId !== existing.albumId) {
    const approved = await db
      .select({
        id: schema.collectionSubmissions.id,
        hash: schema.collectionSubmissions.hash,
        type: schema.collectionSubmissions.type
      })
      .from(schema.collectionSubmissions)
      .where(and(
        eq(schema.collectionSubmissions.linkId, linkId),
        eq(schema.collectionSubmissions.review, 'approved')
      ))
    for (const row of approved) {
      await db
        .update(schema.collectionSubmissions)
        .set({ albumKey: input.albumId ? albumKeyFor(input.albumId, row.hash, row.type) : null })
        .where(eq(schema.collectionSubmissions.id, row.id))
    }
  }

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'collection_link',
    entityId: updated.id,
    entityTitle: updated.label,
    metadata: input
  })

  return { ...updated, open: isLinkOpen(updated) }
})
