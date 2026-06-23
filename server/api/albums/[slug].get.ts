import { and, asc, eq } from 'drizzle-orm'

// Public: a published album and its photos.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''

  const [album] = await db
    .select({
      id: schema.albums.id,
      slug: schema.albums.slug,
      title: schema.albums.title,
      description: schema.albums.description,
      eventDate: schema.albums.eventDate
    })
    .from(schema.albums)
    .where(and(eq(schema.albums.slug, slug), eq(schema.albums.status, 'published')))
    .limit(1)

  if (!album) throw createError({ statusCode: 404, message: 'ไม่พบอัลบั้ม' })

  const photos = await db
    .select({
      id: schema.photos.id,
      r2Key: schema.photos.r2Key,
      width: schema.photos.width,
      height: schema.photos.height,
      caption: schema.photos.caption,
      alt: schema.photos.alt,
      photographer: schema.photos.photographer
    })
    .from(schema.photos)
    .where(eq(schema.photos.albumId, album.id))
    .orderBy(asc(schema.photos.sortOrder), asc(schema.photos.id))

  return { album, photos }
})
