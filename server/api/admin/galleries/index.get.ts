import { alias } from 'drizzle-orm/sqlite-core'
import { desc, eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const cover = alias(schema.photos, 'cover')
  const rows = await db
    .select({
      id: schema.albums.id,
      slug: schema.albums.slug,
      title: schema.albums.title,
      description: schema.albums.description,
      eventDate: schema.albums.eventDate,
      status: schema.albums.status,
      photoCount: sql<number>`(select count(*) from photos where photos.album_id = albums.id)`,
      coverKey: cover.r2Key
    })
    .from(schema.albums)
    .leftJoin(cover, eq(cover.id, schema.albums.coverPhotoId))
    .orderBy(desc(schema.albums.eventDate), desc(schema.albums.createdAt))

  return rows.map(row => ({
    ...row,
    eventDate: row.eventDate?.toISOString() ?? null
  }))
})
