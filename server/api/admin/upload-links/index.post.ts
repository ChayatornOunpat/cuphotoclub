import { z } from 'zod'

const bodySchema = z.object({
  // Required: an unnamed collection is unfindable in the overview once several
  // exist, and the label is the title participants see on the contribute page.
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  coverR2Key: z.string().nullable().optional(),
  requireName: z.boolean().optional(),
  maxPerContributor: z.number().int().min(1).max(1000).optional(),
  maxTotal: z.number().int().min(1).max(20000).optional(),
  compress: z.boolean().optional(),
  compressMaxDim: z.number().int().min(480).max(8000).optional(),
  compressQuality: z.number().int().min(40).max(100).optional(),
  maxBytesPerPhoto: z.number().int().min(256 * 1024).max(MAX_UPLOAD_BYTES).optional(),
  expiresAt: z.string().datetime().nullable().optional()
})

// Open a new photo collection: a share link plus the policy that governs it.
// Collections are standalone — nothing ties one to an event or activity.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const input = result.data

  // "Original" (no compression) plus a tight byte ceiling is a link where every
  // upload fails. Refuse it here rather than letting an admin discover it live.
  if (input.compress === false && (input.maxBytesPerPhoto ?? MAX_UPLOAD_BYTES) < MAX_UPLOAD_BYTES) {
    throw createError({
      statusCode: 400,
      message: 'Turning compression off requires the per-photo limit to stay at the maximum.'
    })
  }

  const [created] = await db
    .insert(schema.collectionLinks)
    .values({
      id: generateLinkToken(),
      label: input.label,
      description: input.description || null,
      coverR2Key: input.coverR2Key ?? null,
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
    entityType: 'collection_link',
    entityId: created.id,
    entityTitle: created.label,
    metadata: { ...input }
  })

  return { ...created, open: isLinkOpen(created), photoCount: 0, contributorCount: 0 }
})
