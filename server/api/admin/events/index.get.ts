import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return db
    .select({
      id: schema.events.id,
      slug: schema.events.slug,
      title: schema.events.title,
      summary: schema.events.summary,
      coverR2Key: schema.events.coverR2Key,
      eventDate: schema.events.eventDate,
      location: schema.events.location,
      registerUrl: schema.events.registerUrl,
      status: schema.events.status,
      publishedAt: schema.events.publishedAt,
      createdAt: schema.events.createdAt
    })
    .from(schema.events)
    .orderBy(desc(schema.events.eventDate), desc(schema.events.createdAt))
})
