import { z } from 'zod'

const bodySchema = z.object({
  nickname:   z.string().trim().min(1).max(80),
  schoolYear: z.number().int().min(1).max(4).nullable().optional(),
  position:   z.string().trim().max(100).nullable().optional(),
  instagram:  z.string().trim().max(60).nullable().optional(),
  photoR2Key: z.string().nullable().optional(),
  active:     z.boolean().optional(),
  sortOrder:  z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const d = result.data

  const [created] = await db
    .insert(schema.members)
    .values({
      nickname:   d.nickname,
      schoolYear: d.schoolYear ?? null,
      position:   d.position ?? null,
      instagram:  d.instagram ?? null,
      photoR2Key: d.photoR2Key ?? null,
      active:     d.active ?? true,
      sortOrder:  d.sortOrder ?? 0
    })
    .returning()

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'member',
    entityId: created.id,
    entityTitle: created.nickname,
    metadata: {
      active: created.active,
      schoolYear: created.schoolYear,
      position: created.position
    }
  })

  return created
})
