import { sql } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  nickname:   z.string().trim().min(1).max(80),
  schoolYear: z.number().int().min(1).max(4).nullable().optional(),
  position:   z.string().trim().max(100).nullable().optional(),
  instagram:  z.string().trim().max(60).nullable().optional(),
  bio:        z.string().trim().max(500).nullable().optional(),
  interests:  z.array(z.string().trim().min(1).max(40)).max(12).optional(),
  featuredLinks: z.array(z.object({
    label: z.string().trim().min(1).max(80),
    url: z.string().trim().min(1).max(240)
  })).max(6).optional(),
  photoR2Key: z.string().nullable().optional(),
  active:     z.boolean().optional(),
  sortOrder:  z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const d = result.data

  // No explicit sortOrder → append after the current last member. Defaulting
  // to 0 would tie with existing rows and make the public order diverge from
  // the admin list.
  let sortOrder = d.sortOrder
  if (sortOrder === undefined) {
    const [maxRow] = await db
      .select({ max: sql<number | null>`max(${schema.members.sortOrder})` })
      .from(schema.members)
    sortOrder = (maxRow?.max ?? -1) + 1
  }

  const [created] = await db
    .insert(schema.members)
    .values({
      nickname:   d.nickname,
      schoolYear: d.schoolYear ?? null,
      position:   d.position ?? null,
      instagram:  d.instagram ?? null,
      bio:        d.bio ?? null,
      interests:  d.interests ?? [],
      featuredLinks: d.featuredLinks ?? [],
      photoR2Key: d.photoR2Key ?? null,
      active:     d.active ?? true,
      sortOrder
    })
    .returning()
  if (!created) throw createError({ statusCode: 500, message: 'สร้างสมาชิกไม่สำเร็จ' })

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
  await purgeSwrCache()

  return created
})
