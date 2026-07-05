import { alias } from 'drizzle-orm/sqlite-core'
import { desc, eq, sql } from 'drizzle-orm'

// Aggregated data for the home page: featured albums, latest posts, recent events.
export default defineEventHandler(async () => {
  const cover = alias(schema.photos, 'cover')

  const albumRows = await db
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
    .limit(6)

  // "Lego-grid" albums built in the canvas editor (schema.contentAlbums, via albumStore) are a
  // separate system from the relational galleries above (schema.albums/photos) — merge both so
  // the home feed reflects everything admins actually publish. See CLAUDE.md / schema.ts comments.
  const contentAlbums = (await albumStore.list())
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

  const posts = await db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      excerpt: schema.posts.excerpt,
      coverR2Key: schema.posts.coverR2Key,
      publishedAt: schema.posts.publishedAt
    })
    .from(schema.posts)
    .where(eq(schema.posts.status, 'published'))
    .orderBy(desc(schema.posts.publishedAt), desc(schema.posts.createdAt))
    .limit(3)

  const events = await db
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

  const galleryAlbums = albumRows.map(({ explicitCoverKey, firstPhotoKey, ...a }) => ({
    ...a,
    coverKey: explicitCoverKey ?? firstPhotoKey ?? null,
    source: 'gallery' as const
  }))

  const albums = [...galleryAlbums, ...contentAlbums]
    .sort((a, b) => (b.eventDate ?? '').localeCompare(a.eventDate ?? ''))
    .slice(0, 6)

  return {
    albums,
    posts,
    events
  }
})
