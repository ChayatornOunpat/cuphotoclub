import { desc, eq, sql } from 'drizzle-orm'
import type { Album, AlbumInput } from '~~/shared/types'
import { readContentAlbums } from './contentAlbumFiles'

// Unicode-aware: keep letters (incl. Thai), digits, and combining marks (Thai
// vowel/tone signs), replacing runs of anything else with a hyphen. A Thai title
// like "รับน้องก้าวใหม่ 2012" becomes the slug "รับน้องก้าวใหม่-2012" (browsers show
// the Thai in the address bar) instead of collapsing to a bare "2012".
function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^\p{L}\p{N}\p{M}]+/gu, '-').replace(/^-|-$/g, '')
}

function withoutOrderPrefix(s: string): string {
  return s.replace(/^\d+-/, '')
}

// Find a slug not already taken by a *different* album. `exceptId` lets an album
// keep its own slug on update without colliding with itself.
async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || 'album'
  let candidate = root
  for (let n = 2; ; n++) {
    const [row] = await db
      .select({ id: schema.contentAlbums.id })
      .from(schema.contentAlbums)
      .where(eq(schema.contentAlbums.slug, candidate))
      .limit(1)
    if (!row || row.id === exceptId) return candidate
    candidate = `${root}-${n}`
  }
}

type AlbumRow = typeof schema.contentAlbums.$inferSelect

function rowToAlbum(row: AlbumRow): Album {
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    published: row.published,
    visibility: row.visibility ?? 'public',
    location: row.location ?? undefined,
    excerpt: row.excerpt,
    style: row.style,
    placement: row.placement,
    coverSrc: row.coverSrc,
    rows: row.rows ?? [],
    updatedAt: row.updatedAt?.toISOString()
  }
}

async function writeAlbum(album: Album): Promise<void> {
  const now = new Date()
  const values = {
    id: album.id,
    slug: album.slug,
    title: album.title,
    category: album.category,
    date: album.date,
    published: album.published,
    visibility: album.visibility ?? 'public',
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
        slug: values.slug,
        title: values.title,
        category: values.category,
        date: values.date,
        published: values.published,
        visibility: values.visibility,
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
            slug: album.slug || album.id,
            title: album.title,
            category: album.category,
            date: album.date,
            published: album.published,
            visibility: album.visibility ?? 'public',
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

  // Resolve by human slug (the URL). Falls back to id so legacy links that used
  // the id directly still work.
  async getBySlug(slug: string): Promise<Album | null> {
    await seedFromContentOnce()
    const [bySlug] = await db
      .select()
      .from(schema.contentAlbums)
      .where(eq(schema.contentAlbums.slug, slug))
      .limit(1)
    if (bySlug) {
      const album = rowToAlbum(bySlug)
      return realDataOnly() && containsMockMedia(album) ? null : album
    }
    return this.get(slug)
  },

  async create(input: AlbumInput): Promise<Album> {
    await seedFromContentOnce()
    const id = crypto.randomUUID()
    const slug = await uniqueSlug(input.title || 'album')
    const album: Album = { ...input, id, slug }
    await writeAlbum(album)
    return album
  },

  // Album-first: an empty draft created before any title/photos exist. Its id is
  // the permanent R2 folder; images upload straight into content-albums/<id>/.
  async createDraft(): Promise<Album> {
    await seedFromContentOnce()
    const id = crypto.randomUUID()
    // Placeholder slug while the draft is untitled; update() sets the real one
    // from the title on first save.
    const slug = await uniqueSlug(`draft-${id.slice(0, 8)}`)
    const today = new Date().toISOString().slice(0, 10)
    const album: Album = {
      id,
      slug,
      title: '',
      category: '',
      date: today,
      published: today,
      visibility: 'draft',
      excerpt: '',
      style: 'essay',
      placement: 'gallery',
      coverSrc: '',
      rows: []
    }
    await writeAlbum(album)
    return album
  },

  async update(id: string, input: AlbumInput, opts?: { createIfMissing?: boolean }): Promise<Album | null> {
    await seedFromContentOnce()
    const existing = await this.get(id)
    // createIfMissing: another editor may delete a draft row while its creator
    // still has the canvas open — that save must re-create the album, not 404.
    if (!existing && !opts?.createIfMissing) return null

    // Keep the URL slug in sync with the title. slugify is deterministic, so
    // re-saving the same title yields the same slug (exceptId prevents a
    // self-collision). The R2 folder (= id) never moves regardless.
    const targetId = existing?.id ?? id
    const slug = input.title.trim()
      ? await uniqueSlug(input.title, targetId)
      : (existing?.slug ?? await uniqueSlug(`draft-${targetId.slice(0, 8)}`))
    const album: Album = { ...input, id: targetId, slug }
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
