import { and, asc, desc, eq, or, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import type { Album, AlbumInput, AlbumListItem, AlbumPickerItem, AlbumRow, ContentStatus } from '~~/shared/types'
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

// The two things every list view needs out of `rows`. They are stored as their
// own columns (auto_cover_src / photo_count) so listing albums never has to read
// the rows JSON — see the comment on the schema columns.
function imageCells(rows: AlbumRow[] | null | undefined) {
  return (rows ?? []).flatMap(row => row.cells).filter(cell => cell.type === 'image' && cell.src)
}

function derivedFromRows(rows: AlbumRow[] | null | undefined) {
  const images = imageCells(rows)
  return { autoCoverSrc: images[0]?.src ?? '', photoCount: images.length }
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

type AlbumDbRow = typeof schema.contentAlbums.$inferSelect

function rowToAlbum(row: AlbumDbRow): Album {
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    dateEnd: row.dateEnd ?? undefined,
    published: row.published,
    visibility: row.visibility ?? 'public',
    location: row.location ?? undefined,
    excerpt: row.excerpt,
    style: row.style,
    dark: row.dark,
    placement: row.placement,
    coverSrc: row.coverSrc,
    rows: row.rows ?? [],
    textDefaults: row.textDefaults ?? undefined,
    updatedAt: row.updatedAt?.toISOString()
  }
}

async function writeAlbum(album: Album): Promise<void> {
  const now = new Date()
  const derived = derivedFromRows(album.rows)
  const values = {
    id: album.id,
    slug: album.slug,
    title: album.title,
    category: album.category,
    date: album.date,
    dateEnd: album.dateEnd ?? null,
    published: album.published,
    visibility: album.visibility ?? 'public',
    location: album.location ?? null,
    excerpt: album.excerpt,
    style: album.style,
    dark: album.dark ?? false,
    placement: album.placement,
    coverSrc: album.coverSrc,
    autoCoverSrc: derived.autoCoverSrc,
    photoCount: derived.photoCount,
    rows: album.rows,
    textDefaults: album.textDefaults ?? null,
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
        dateEnd: values.dateEnd,
        published: values.published,
        visibility: values.visibility,
        location: values.location,
        excerpt: values.excerpt,
        style: values.style,
        dark: values.dark,
        placement: values.placement,
        coverSrc: values.coverSrc,
        autoCoverSrc: values.autoCoverSrc,
        photoCount: values.photoCount,
        rows: values.rows,
        textDefaults: values.textDefaults,
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
            dateEnd: album.dateEnd ?? null,
            published: album.published,
            visibility: album.visibility ?? 'public',
            location: album.location ?? null,
            excerpt: album.excerpt,
            style: album.style,
            placement: album.placement,
            coverSrc: album.coverSrc,
            ...derivedFromRows(album.rows),
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

export type AlbumListSort = 'newest' | 'oldest' | 'title' | 'category' | 'modified'

export interface AlbumListQuery {
  /** Case-insensitive match against title / category / location / excerpt. */
  q?: string
  sort?: AlbumListSort
  /** Omit to get every album; set to page the result. */
  limit?: number
  offset?: number
  /** Restrict to these visibilities (the public archive passes ['public']). */
  visibility?: ContentStatus[]
}

// Every column except `rows_json`. Selecting these explicitly is the whole point
// of listMeta: the rows blob is ~3MB across the album table and no list view
// needs it.
const listColumns = {
  id: schema.contentAlbums.id,
  slug: schema.contentAlbums.slug,
  title: schema.contentAlbums.title,
  category: schema.contentAlbums.category,
  date: schema.contentAlbums.date,
  dateEnd: schema.contentAlbums.dateEnd,
  published: schema.contentAlbums.published,
  visibility: schema.contentAlbums.visibility,
  location: schema.contentAlbums.location,
  excerpt: schema.contentAlbums.excerpt,
  style: schema.contentAlbums.style,
  dark: schema.contentAlbums.dark,
  placement: schema.contentAlbums.placement,
  coverSrc: schema.contentAlbums.coverSrc,
  autoCoverSrc: schema.contentAlbums.autoCoverSrc,
  photoCount: schema.contentAlbums.photoCount,
  textDefaults: schema.contentAlbums.textDefaults,
  updatedAt: schema.contentAlbums.updatedAt
}

type ListRow = { [K in keyof typeof listColumns]: AlbumDbRow[K] }

function rowToListItem(row: ListRow): AlbumListItem {
  return {
    id: row.id,
    slug: row.slug || row.id,
    title: row.title,
    category: row.category,
    date: row.date,
    dateEnd: row.dateEnd ?? undefined,
    published: row.published,
    visibility: row.visibility ?? 'public',
    location: row.location ?? undefined,
    excerpt: row.excerpt,
    style: row.style,
    dark: row.dark,
    placement: row.placement,
    // Resolved server-side so callers never need `rows` to show a thumbnail.
    coverSrc: row.coverSrc || row.autoCoverSrc || '',
    photoCount: row.photoCount,
    textDefaults: row.textDefaults ?? undefined,
    updatedAt: row.updatedAt?.toISOString()
  }
}

function listOrderBy(sort: AlbumListSort) {
  const c = schema.contentAlbums
  if (sort === 'oldest') return [asc(c.published), asc(c.id)]
  if (sort === 'title') return [asc(c.title), asc(c.id)]
  if (sort === 'category') return [asc(c.category), desc(c.published), asc(c.id)]
  if (sort === 'modified') return [desc(c.updatedAt), asc(c.id)]
  return [desc(c.published), asc(c.id)]
}

function listWhere(query: AlbumListQuery) {
  const c = schema.contentAlbums
  const clauses: (SQL | undefined)[] = []

  if (query.visibility?.length) {
    clauses.push(or(...query.visibility.map(value => eq(c.visibility, value))))
  }

  const term = query.q?.trim().toLowerCase()
  if (term) {
    // Backslash-escape the LIKE wildcards (and the escape char itself) so a
    // literal % or _ typed into the search box matches itself. SQLite only
    // honours that with an explicit ESCAPE clause, hence the raw comparison.
    const pattern = `%${term.replace(/[\\%_]/g, ch => `\\${ch}`)}%`
    const matches = (col: AnySQLiteColumn) =>
      sql`lower(coalesce(${col}, '')) LIKE ${pattern} ESCAPE '\\'`
    clauses.push(or(
      matches(c.title),
      matches(c.category),
      matches(c.location),
      matches(c.excerpt),
      matches(c.style)
    ))
  }

  // The seeded demo albums point every image at picsum.photos, so excluding
  // them is a cover check. Done in SQL rather than after the fact so `total`
  // and the paged slice agree. (Production never seeds them — see
  // seedFromContentOnce — this only matters for a local db run with real-data
  // mode on.)
  if (realDataOnly()) {
    clauses.push(sql`${c.coverSrc} NOT LIKE '%picsum.photos%' AND ${c.autoCoverSrc} NOT LIKE '%picsum.photos%'`)
  }

  return clauses.length ? and(...clauses) : undefined
}

/** One public album's image srcs plus the metadata the photo grid tiles need. */
export interface AlbumPhotoRef {
  id: string
  title: string
  coverSrc: string
  date: string
  dateEnd?: string
  photoCount: number
  srcs: string[]
}

export const albumStore = {
  /**
   * Albums without their `rows` — for archives, admin tables, the home feed and
   * the sitemap. Pass `limit`/`offset` to page; `total` is the count before
   * paging so callers can render a pager. Use `list()` only when you genuinely
   * need every photo (R2 reference scans).
   */
  async listMeta(query: AlbumListQuery = {}): Promise<{ items: AlbumListItem[], total: number }> {
    await seedFromContentOnce()
    const where = listWhere(query)

    const rowsQuery = db
      .select(listColumns)
      .from(schema.contentAlbums)
      .where(where)
      .orderBy(...listOrderBy(query.sort ?? 'newest'))

    const [rows, countRows] = await Promise.all([
      query.limit === undefined
        ? rowsQuery
        : rowsQuery.limit(query.limit).offset(query.offset ?? 0),
      db
        .select({ count: sql<number>`count(*)` })
        .from(schema.contentAlbums)
        .where(where)
    ])

    const items = rows.map(rowToListItem)
    return { items, total: countRows[0]?.count ?? items.length }
  },

  /** How many albums exist, for dashboards that only render the number. */
  async count(): Promise<number> {
    await seedFromContentOnce()
    const [row] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.contentAlbums)
      .where(listWhere({}))
    return row?.count ?? 0
  },

  /** id/title/slug for album dropdowns — the smallest useful payload. */
  async listPicker(): Promise<AlbumPickerItem[]> {
    await seedFromContentOnce()
    const c = schema.contentAlbums
    const rows = await db
      .select({ id: c.id, slug: c.slug, title: c.title, category: c.category, visibility: c.visibility })
      .from(c)
      .where(listWhere({}))
      .orderBy(desc(c.published), asc(c.id))
    return rows.map(row => ({ ...row, slug: row.slug || row.id, visibility: row.visibility ?? 'public' }))
  },

  /**
   * Every public album's image srcs, for the home page photo grid.
   *
   * The grid needs each src but none of the surrounding layout, so this pulls
   * the srcs out with json_each instead of shipping `rows_json` to the Worker.
   * `list()` did the latter: ~3MB out of D1 and a JSON.parse per album on every
   * cold isolate, which took seconds and left the Featured Work wall blank
   * while the client waited. `photo_count` is already derived on write, so the
   * count comes free rather than from re-walking the rows.
   */
  async listPhotoGrid(): Promise<AlbumPhotoRef[]> {
    await seedFromContentOnce()

    // The same picsum cover check listWhere() applies — see the note there for
    // why a cover check is enough.
    const mockFilter = realDataOnly()
      ? sql` AND a.cover_src NOT LIKE '%picsum.photos%' AND a.auto_cover_src NOT LIKE '%picsum.photos%'`
      : sql.empty()

    const rows = await db.all<{
      id: string
      title: string
      cover_src: string
      date: string
      date_end: string | null
      photo_count: number
      srcs: string | null
    }>(sql`
      SELECT a.id,
             a.title,
             a.cover_src,
             a.date,
             a.date_end,
             a.photo_count,
             (
               SELECT group_concat(c.value ->> '$.src', char(10))
               FROM json_each(a.rows_json) AS r,
                    json_each(r.value -> '$.cells') AS c
               WHERE c.value ->> '$.type' = 'image'
                 AND trim(coalesce(c.value ->> '$.src', '')) <> ''
             ) AS srcs
      FROM content_albums AS a
      WHERE a.visibility = 'public'${mockFilter}
      ORDER BY a.published DESC
    `)

    return rows.map(row => ({
      id: row.id,
      title: row.title,
      coverSrc: row.cover_src ?? '',
      date: row.date,
      dateEnd: row.date_end ?? undefined,
      photoCount: row.photo_count,
      srcs: row.srcs ? row.srcs.split('\n') : []
    }))
  },

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
