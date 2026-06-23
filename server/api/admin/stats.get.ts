import { count, eq, isNull } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [[albums], [photos], [posts], [events], [unread]] = await Promise.all([
    db.select({ c: count() }).from(schema.albums),
    db.select({ c: count() }).from(schema.photos),
    db.select({ c: count() }).from(schema.posts),
    db.select({ c: count() }).from(schema.events),
    db.select({ c: count() }).from(schema.contactMessages).where(isNull(schema.contactMessages.readAt))
  ])

  const [[publishedAlbums]] = await Promise.all([
    db.select({ c: count() }).from(schema.albums).where(eq(schema.albums.status, 'published'))
  ])

  return {
    albums: albums.c,
    publishedAlbums: publishedAlbums.c,
    photos: photos.c,
    posts: posts.c,
    events: events.c,
    unreadMessages: unread.c
  }
})
