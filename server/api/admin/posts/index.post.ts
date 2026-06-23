import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1),
  slug: z.string().trim().optional(),
  excerpt: z.string().trim().optional(),
  body: z.string().optional(),
  coverR2Key: z.string().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  status: z.enum(['draft', 'published']).optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const slug = await uniqueSlug(schema.posts, data.slug || data.title)
  const status = data.status ?? 'draft'

  const [created] = await db
    .insert(schema.posts)
    .values({
      title: data.title,
      slug,
      excerpt: data.excerpt ?? null,
      body: data.body ?? '',
      coverR2Key: data.coverR2Key ?? null,
      tags: data.tags ?? [],
      status,
      publishedAt: status === 'published' ? new Date() : null,
      authorId: actor.id
    })
    .returning()

  return created
})
