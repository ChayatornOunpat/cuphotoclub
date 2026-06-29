import type { Album, AlbumInput } from '~~/shared/types'
import { appDb } from './appDb'
import { readContentAlbums } from './contentAlbumFiles'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function withoutOrderPrefix(s: string): string {
  return s.replace(/^\d+-/, '')
}

// Ensure app_meta table exists first so we can check schema version.
appDb.exec(`
  CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`)

// Schema v3: replaced blocks_json with rows_json (Lego grid system).
// Drop albums table on any schema older than v3 so it is recreated and re-seeded.
const versionRow = appDb.prepare('SELECT value FROM app_meta WHERE key = ?').get('schema_version') as { value: string } | undefined
const schemaVersion = versionRow ? Number(versionRow.value) : 0

if (schemaVersion < 3) {
  appDb.exec('DROP TABLE IF EXISTS albums')
  appDb.prepare(`
    INSERT INTO app_meta (key, value) VALUES ('schema_version', '3')
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run()
  appDb.prepare(`DELETE FROM app_meta WHERE key = 'albums_seeded_from_content'`).run()
}

appDb.exec(`
  CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    published TEXT NOT NULL,
    location TEXT,
    excerpt TEXT NOT NULL,
    style TEXT NOT NULL,
    placement TEXT NOT NULL,
    cover_src TEXT NOT NULL DEFAULT '',
    rows_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

function rowToAlbum(row: any): Album {
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
    coverSrc: row.cover_src,
    rows: JSON.parse(row.rows_json)
  }
}

function writeAlbum(album: Album) {
  appDb.prepare(`
    INSERT INTO albums (
      id, title, category, date, published, location, excerpt, style, placement, cover_src, rows_json, updated_at
    )
    VALUES (
      @id, @title, @category, @date, @published, @location, @excerpt, @style, @placement, @coverSrc, @rowsJson, CURRENT_TIMESTAMP
    )
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      category = excluded.category,
      date = excluded.date,
      published = excluded.published,
      location = excluded.location,
      excerpt = excluded.excerpt,
      style = excluded.style,
      placement = excluded.placement,
      cover_src = excluded.cover_src,
      rows_json = excluded.rows_json,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    ...album,
    location: album.location ?? null,
    rowsJson: JSON.stringify(album.rows)
  })
}

function seedFromContentOnce() {
  const count = (appDb.prepare('SELECT COUNT(*) as count FROM albums').get() as { count: number }).count
  const seeded = appDb.prepare('SELECT value FROM app_meta WHERE key = ?').get('albums_seeded_from_content')
  if (count > 0 && seeded) return

  const insertMany = appDb.transaction((albums: Album[]) => {
    const exists = appDb.prepare('SELECT id FROM albums WHERE id = ?')
    for (const album of albums) {
      if (!exists.get(album.id)) writeAlbum(album)
    }
    appDb.prepare(`
      INSERT INTO app_meta (key, value)
      VALUES ('albums_seeded_from_content', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run()
  })
  insertMany(readContentAlbums())
}

export const albumStore = {
  list(): Album[] {
    seedFromContentOnce()
    return appDb
      .prepare('SELECT * FROM albums ORDER BY published DESC')
      .all()
      .map(rowToAlbum)
  },

  get(id: string): Album | null {
    seedFromContentOnce()
    const exact = appDb.prepare('SELECT * FROM albums WHERE id = ?').get(id)
    if (exact) return rowToAlbum(exact)

    return this.list().find(album => withoutOrderPrefix(album.id) === id) ?? null
  },

  create(input: AlbumInput): Album {
    seedFromContentOnce()
    let id = slugify(input.title) || `album-${Date.now()}`
    if (this.get(id)) id = `${id}-${Date.now().toString(36)}`

    const album: Album = { ...input, id }
    writeAlbum(album)
    return album
  },

  update(id: string, input: AlbumInput): Album | null {
    seedFromContentOnce()
    if (!this.get(id)) return null

    const album: Album = { ...input, id }
    writeAlbum(album)
    return album
  },

  remove(id: string): boolean {
    seedFromContentOnce()
    const result = appDb.prepare('DELETE FROM albums WHERE id = ?').run(id)
    return (result as { changes: number }).changes > 0
  }
}
