import { alias } from 'drizzle-orm/sqlite-core'
import { desc, eq, sql } from 'drizzle-orm'

// Aggregated data for the home page: featured albums, latest posts, recent events.
export default defineEventHandler(async () => {
  const cover = alias(schema.photos, 'cover')

  // The four sources are independent — fetch them in parallel (each await in
  // sequence would add a full D1/KV round trip to the response time).
  const albumRowsQuery = db
    .select({
      id: schema.albums.id,
      slug: schema.albums.slug,
      title: schema.albums.title,
      eventDate: schema.albums.eventDate,
      explicitCoverKey: cover.r2Key,
      firstPhotoKey: sql<string | null>`(select r2_key from photos where photos.album_id = albums.id order by photos.sort_order, photos.id limit 1)`,
      photoCount: sql<number>`(select count(*) from photos where photos.album_id = albums.id)`
    })
    .from(schema.albums)
    .leftJoin(cover, eq(cover.id, schema.albums.coverPhotoId))
    .where(eq(schema.albums.status, 'published'))
    .orderBy(desc(schema.albums.eventDate), desc(schema.albums.createdAt))
    .limit(10)

  const eventsQuery = db
    .select({
      id: schema.events.id,
      slug: schema.events.slug,
      title: schema.events.title,
      summary: schema.events.summary,
      coverR2Key: schema.events.coverR2Key,
      eventDate: schema.events.eventDate,
      location: schema.events.location
    })
    .from(schema.events)
    .where(eq(schema.events.status, 'published'))
    .orderBy(desc(schema.events.eventDate), desc(schema.events.createdAt))
    .limit(3)

  const [albumRows, contentAlbumList, postList, events] = await Promise.all([
    albumRowsQuery,
    albumStore.list(),
    postStore.list(),
    eventsQuery
  ])

  // "Lego-grid" albums built in the canvas editor (schema.contentAlbums, via albumStore) are a
  // separate system from the relational galleries above (schema.albums/photos) — merge both so
  // the home feed reflects everything admins actually publish. See CLAUDE.md / schema.ts comments.
  const contentAlbums = contentAlbumList
    .filter(a => a.visibility === 'public')
    .map(a => ({
      id: 0,
      slug: a.id,
      title: a.title,
      eventDate: a.published || a.date,
      coverKey: a.coverSrc || (a.rows ?? []).flatMap(r => r.cells).find(c => c.type === 'image' && c.src)?.src || null,
      photoCount: (a.rows ?? []).flatMap(r => r.cells).filter(c => c.type === 'image' && c.src).length,
      source: 'content' as const
    }))

  // Editorial posts are managed via the block-based editor (schema.contentPosts, via
  // postStore) — the same "content store" pattern as contentAlbums above.
  const posts = postList
    .filter(p => p.visibility === 'public')
    .sort((a, b) => b.published.localeCompare(a.published))
    .slice(0, 3)
    .map(p => ({
      slug: p.id,
      title: p.title,
      excerpt: p.excerpt,
      coverR2Key: p.image,
      publishedAt: p.published
    }))

  const galleryAlbums = albumRows.map(({ explicitCoverKey, firstPhotoKey, eventDate, ...a }) => ({
    ...a,
    // Relational albums store eventDate as a Date; content albums use ISO strings.
    // Normalize to string so the merged sort below can localeCompare safely.
    eventDate: eventDate instanceof Date ? eventDate.toISOString().slice(0, 10) : eventDate,
    coverKey: explicitCoverKey ?? firstPhotoKey ?? null,
    source: 'gallery' as const
  }))

  const albums = [...galleryAlbums, ...contentAlbums]
    .sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''))
    .slice(0, 10)

  return {
    albums,
    posts,
    events
  }
})
