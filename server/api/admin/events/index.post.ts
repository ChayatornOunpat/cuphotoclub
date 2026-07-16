import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  summary: z.string().trim().optional(),
  body: z.string().optional(),
  eventDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  location: z.string().trim().nullable().optional(),
  coverR2Key: z.string().nullable().optional(),
  registerUrl: z.string().trim().nullable().optional(),
  status: z.enum(['draft', 'published']).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const slug = await uniqueSlug(schema.events, data.slug || data.title)
  const status = data.status ?? 'draft'

  const eventDate = data.eventDate ? new Date(data.eventDate) : null
  const endDate = data.endDate ? new Date(data.endDate) : null
  if (endDate && (!eventDate || endDate < eventDate)) {
    throw createError({ statusCode: 400, message: 'วันสิ้นสุดต้องไม่มาก่อนวันเริ่มกิจกรรม' })
  }

  const [created] = await db
    .insert(schema.events)
    .values({
      title: data.title,
      slug,
      summary: data.summary ?? null,
      body: data.body ?? '',
      eventDate,
      endDate,
      location: data.location ?? null,
      coverR2Key: data.coverR2Key ?? null,
      registerUrl: data.registerUrl || null,
      status,
      publishedAt: status === 'published' ? new Date() : null
    })
    .returning()
  if (!created) throw createError({ statusCode: 500, message: 'สร้างกิจกรรมไม่สำเร็จ' })

  await recordAdminAudit(actor, {
    action: 'create',
    entityType: 'event',
    entityId: created.id,
    entityTitle: created.title,
    metadata: {
      status: created.status,
      slug: created.slug,
      eventDate: created.eventDate?.toISOString?.()
    }
  })

  return created
})
