import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  excerpt: z.string().trim().nullable().optional(),
  body: z.string().optional(),
  coverR2Key: z.string().nullable().optional(),
  tags: z.array(z.string().trim()).optional(),
  status: z.enum(['draft', 'published']).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, message: 'ไม่พบบทความ' })

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (data.title !== undefined) updates.title = data.title
  if (data.excerpt !== undefined) updates.excerpt = data.excerpt
  if (data.body !== undefined) updates.body = data.body
  if (data.tags !== undefined) updates.tags = data.tags
  if (data.slug !== undefined) updates.slug = await uniqueSlug(schema.posts, data.slug, id)
  if (data.status !== undefined) {
    updates.status = data.status
    if (data.status === 'published' && !post.publishedAt) updates.publishedAt = new Date()
  }
  if (data.coverR2Key !== undefined) {
    updates.coverR2Key = data.coverR2Key
    // Remove the previous cover blob if it was replaced/cleared.
    if (post.coverR2Key && post.coverR2Key !== data.coverR2Key) {
      await blob.delete(post.coverR2Key).catch(() => {})
    }
  }

  await db.update(schema.posts).set(updates).where(eq(schema.posts.id, id))
  return { ok: true }
})
