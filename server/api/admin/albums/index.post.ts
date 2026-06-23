import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  description: z.string().trim().optional(),
  eventDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'published']).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const slug = await uniqueAlbumSlug(data.slug || data.title)
  const status = data.status ?? 'draft'

  const [created] = await db
    .insert(schema.albums)
    .values({
      title: data.title,
      slug,
      description: data.description ?? null,
      eventDate: data.eventDate ? new Date(data.eventDate) : null,
      status,
      publishedAt: status === 'published' ? new Date() : null,
      createdBy: actor.id
    })
    .returning()

  return created
})
