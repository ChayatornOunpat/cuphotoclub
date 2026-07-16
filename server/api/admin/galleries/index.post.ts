import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1),
  eventDate: z.string().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft')
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) {
    throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  }

  const data = result.data
  const slug = await uniqueAlbumSlug(data.title)
  const now = new Date()
  const [created] = await db
    .insert(schema.albums)
    .values({
      title: data.title,
      slug,
      description: data.description ?? null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      status: data.status,
      publishedAt: data.status === 'published' ? now : null,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now
    })
    .returning()
  if (!created) throw createError({ statusCode: 500, message: 'สร้างอัลบั้มไม่สำเร็จ' })

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'gallery',
    entityId: created.id,
    entityTitle: created.title,
    metadata: {
      slug: created.slug,
      status: created.status
    }
  })

  return {
    ...created,
    eventDate: created.eventDate?.toISOString() ?? null,
    publishedAt: created.publishedAt?.toISOString() ?? null,
    createdAt: created.createdAt?.toISOString() ?? null,
    updatedAt: created.updatedAt?.toISOString() ?? null
  }
})
