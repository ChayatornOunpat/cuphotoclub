import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  caption: z.string().trim().max(500).optional()
})

// Edit a caption on one of your own photos, while the link is open.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireOpenLink(token)
  const contributor = await requireContributor(event, link)
  const id = getRouterParam(event, 'id') || ''

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })

  // Scoped to this contributor, so an id belonging to someone else simply is
  // not found rather than being rejected — no probing for other people's rows.
  const updated = await db
    .update(schema.collectionSubmissions)
    .set({ caption: result.data.caption?.trim() || null })
    .where(and(
      eq(schema.collectionSubmissions.id, id),
      eq(schema.collectionSubmissions.contributorId, contributor.id)
    ))
    .returning({ id: schema.collectionSubmissions.id, caption: schema.collectionSubmissions.caption })

  if (!updated.length) throw createError({ statusCode: 404, message: 'ไม่พบรูปนี้' })
  return { ok: true, item: updated[0] }
})
