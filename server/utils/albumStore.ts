import { desc, eq, sql } from 'drizzle-orm'
import type { Album, AlbumInput } from '~~/shared/types'
import { readContentAlbums } from './contentAlbumFiles'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function withoutOrderPrefix(s: string): string {
  return s.replace(/^\d+-/, '')
}

type AlbumRow = typeof schema.contentAlbums.$inferSelect

function rowToAlbum(row: AlbumRow): Album {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    published: row.published,
    location: row.location ?? undefined,
    excerpt: row.excerpt,
    style: row.style,
    placement: row.placement,
    coverSrc: row.coverSrc,
    rows: row.rows ?? []
  }
}

async function writeAlbum(album: Album): Promise<void> {
  const now = new Date()
  const values = {
    id: album.id,
    title: album.title,
    category: album.category,
    date: album.date,
    published: album.published,
    location: album.location ?? null,
    excerpt: album.excerpt,
    style: album.style,
    placement: album.placement,
    coverSrc: album.coverSrc,
    rows: album.rows,
    updatedAt: now
  }

  await db
    .insert(schema.contentAlbums)
    .values(values)
    .onConflictDoUpdate({
      target: schema.contentAlbums.id,
      set: {
        title: values.title,
        category: values.category,
        date: values.date,
        published: values.published,
        location: values.location,
        excerpt: values.excerpt,
        style: values.style,
        placement: values.placement,
        coverSrc: values.coverSrc,
        rows: values.rows,
        updatedAt: now
      }
    })
}

// Seed content albums once. NuxtHub's DB has no app_meta table, so we treat a
// non-empty content_albums table as "already seeded" and only insert albums
// that don't yet exist (idempotent).
let seedPromise: Promise<void> | null = null
function seedFromContentOnce(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.contentAlbums)
      if (count > 0) return
      if (realDataOnly()) return

      const contentAlbums = await readContentAlbums()
      for (const album of contentAlbums) {
        await db
          .insert(schema.contentAlbums)
          .values({
            id: album.id,
            title: album.title,
            category: album.category,
            date: album.date,
            published: album.published,
            location: album.location ?? null,
            excerpt: album.excerpt,
            style: album.style,
            placement: album.placement,
            coverSrc: album.coverSrc,
            rows: album.rows
          })
          .onConflictDoNothing({ target: schema.contentAlbums.id })
      }
    })().catch((err) => {
      // Allow a later call to retry if seeding failed.
      seedPromise = null
      throw err
    })
  }
  return seedPromise
}

export const albumStore = {
  async list(): Promise<Album[]> {
    await seedFromContentOnce()
    const rows = await db
      .select()
      .from(schema.contentAlbums)
      .orderBy(desc(schema.contentAlbums.published))
    const albums = rows.map(rowToAlbum)
    return realDataOnly() ? albums.filter(album => !containsMockMedia(album)) : albums
  },

  async get(id: string): Promise<Album | null> {
    await seedFromContentOnce()
    const [exact] = await db
      .select()
      .from(schema.contentAlbums)
      .where(eq(schema.contentAlbums.id, id))
      .limit(1)
    if (exact) {
      const album = rowToAlbum(exact)
      return realDataOnly() && containsMockMedia(album) ? null : album
    }

    const all = await this.list()
    return all.find(album => withoutOrderPrefix(album.id) === id) ?? null
  },

  async create(input: AlbumInput): Promise<Album> {
    await seedFromContentOnce()
    let id = slugify(input.title) || `album-${Date.now()}`
    if (await this.get(id)) id = `${id}-${Date.now().toString(36)}`

    const album: Album = { ...input, id }
    await writeAlbum(album)
    return album
  },

  async update(id: string, input: AlbumInput): Promise<Album | null> {
    await seedFromContentOnce()
    if (!(await this.get(id))) return null

    const album: Album = { ...input, id }
    await writeAlbum(album)
    return album
  },

  async remove(id: string): Promise<boolean> {
    await seedFromContentOnce()
    const [existing] = await db
      .select({ id: schema.contentAlbums.id })
      .from(schema.contentAlbums)
      .where(eq(schema.contentAlbums.id, id))
      .limit(1)
    if (!existing) return false
    await db.delete(schema.contentAlbums).where(eq(schema.contentAlbums.id, id))
    return true
  }
}
