import { desc, eq } from 'drizzle-orm'

// Public: published events (most recent / upcoming first).
export default defineEventHandler(async () => {
  const rows = await db
    .select({
      id: schema.events.id,
      slug: schema.events.slug,
      title: schema.events.title,
      summary: schema.events.summary,
      coverR2Key: schema.events.coverR2Key,
      eventDate: schema.events.eventDate,
      endDate: schema.events.endDate,
      location: schema.events.location,
      registerUrl: schema.events.registerUrl
    })
    .from(schema.events)
    .where(eq(schema.events.status, 'published'))
    .orderBy(desc(schema.events.eventDate), desc(schema.events.createdAt))

  // Empty dev DB: serve mock activities so the calendar has something to show.
  if (import.meta.dev && !rows.length) {
    return devMockEvents().map(({ body, publishedAt, ...row }) => row)
  }
  return rows
})
