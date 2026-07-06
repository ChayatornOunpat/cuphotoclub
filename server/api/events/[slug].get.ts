import { and, eq } from 'drizzle-orm'

// Public: a published event with rendered HTML body.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''

  const [row] = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.slug, slug), eq(schema.events.status, 'published')))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบกิจกรรม' })

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    coverR2Key: row.coverR2Key,
    eventDate: row.eventDate,
    endDate: row.endDate,
    location: row.location,
    registerUrl: row.registerUrl,
    publishedAt: row.publishedAt,
    bodyHtml: renderMarkdown(row.body)
  }
})
