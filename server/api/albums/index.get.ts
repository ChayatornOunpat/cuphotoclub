import { alias } from 'drizzle-orm/sqlite-core'
import { desc, eq, sql } from 'drizzle-orm'

// Public: published albums with cover + photo count.
// Explicit cover via JOIN (libsql dislikes cover_photo_id inside a subquery ORDER BY),
// fallback to the first photo via a simple correlated subquery on album_id.
export default defineEventHandler(async () => {
  const cover = alias(schema.photos, 'cover')

  const rows = await db
    .select({
      id: schema.albums.id,
      slug: schema.albums.slug,
      title: schema.albums.title,
      description: schema.albums.description,
      eventDate: schema.albums.eventDate,
      explicitCoverKey: cover.r2Key,
      firstPhotoKey: sql<string | null>`(select r2_key from photos where photos.album_id = albums.id order by photos.sort_order, photos.id limit 1)`,
      photoCount: sql<number>`(select count(*) from photos where photos.album_id = albums.id)`
    })
    .from(schema.albums)
    .leftJoin(cover, eq(cover.id, schema.albums.coverPhotoId))
    .where(eq(schema.albums.status, 'published'))
    .orderBy(desc(schema.albums.eventDate), desc(schema.albums.createdAt))

  return rows.map(({ explicitCoverKey, firstPhotoKey, ...a }) => ({
    ...a,
    coverKey: explicitCoverKey ?? firstPhotoKey ?? null
  }))
})
