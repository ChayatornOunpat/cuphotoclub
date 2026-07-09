import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core'

const createdAt = integer('created_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`)
const updatedAt = integer('updated_at', { mode: 'timestamp' })
  .notNull()
  .default(sql`(unixepoch())`)

// Admins / allow-list. A row here = permission to sign in (OAuth or password).
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['owner', 'admin', 'editor'] })
    .notNull()
    .default('editor'),
  passwordHash: text('password_hash'),
  googleSub: text('google_sub'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt,
  lastLoginAt: integer('last_login_at', { mode: 'timestamp' })
})

// Galleries = event albums.
export const albums = sqliteTable('albums', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  eventDate: integer('event_date', { mode: 'timestamp' }),
  // plain id (no FK) to avoid a circular constraint with photos.album_id
  coverPhotoId: integer('cover_photo_id'),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  sortOrder: integer('sort_order').notNull().default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt,
  updatedAt
})

export const photos = sqliteTable('photos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  albumId: integer('album_id')
    .notNull()
    .references(() => albums.id, { onDelete: 'cascade' }),
  r2Key: text('r2_key').notNull(),
  width: integer('width'),
  height: integer('height'),
  placeholder: text('placeholder'), // LQIP / blurhash for fast loads
  caption: text('caption'),
  alt: text('alt'),
  photographer: text('photographer'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt
}, table => [
  // SQLite doesn't index FKs automatically; album pages and the home feed all
  // filter or join photos on album_id, so without this each read is a full scan.
  index('photos_album_id_idx').on(table.albumId)
])

export const posts = sqliteTable('posts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  body: text('body').notNull().default(''), // markdown
  coverR2Key: text('cover_r2_key'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  authorId: integer('author_id').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  createdAt,
  updatedAt
})

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  summary: text('summary'),
  body: text('body').notNull().default(''), // markdown
  eventDate: integer('event_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }), // optional last day for multi-day events
  location: text('location'),
  coverR2Key: text('cover_r2_key'),
  registerUrl: text('register_url'), // optional external sign-up link
  status: text('status', { enum: ['draft', 'published'] })
    .notNull()
    .default('draft'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt,
  updatedAt
})

// Singleton editable pages (e.g. key = 'about').
export const pages = sqliteTable('pages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  body: text('body').notNull().default(''), // markdown
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt
})

export const contactMessages = sqliteTable('contact_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  subject: text('subject'),
  message: text('message').notNull(),
  createdAt,
  readAt: integer('read_at', { mode: 'timestamp' }),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false)
})

export const members = sqliteTable('members', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  nickname:   text('nickname').notNull(),
  photoR2Key: text('photo_r2_key'),
  schoolYear: integer('school_year'),          // 1–4
  position:   text('position'),                // null = regular member
  instagram:  text('instagram'),               // handle only, no @
  active:     integer('active', { mode: 'boolean' }).notNull().default(true),
  sortOrder:  integer('sort_order').notNull().default(0),
  createdAt
})

// Site-wide settings (nav, socials, footer, SEO defaults) as key/JSON pairs.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
  updatedAt
})

// ─── Editorial content stores ────────────────────────────────────────────────
// Slug-keyed editorial content (Lego-grid albums, block-based posts) managed by
// albumStore / postStore. Separate from the relational `albums` / `posts` tables
// above, which model the photo-gallery domain (integer ids, R2 photos, FKs).

import type { AlbumRow, AlbumStyle, ContentStatus, HeroStyle, Placement, PostBlock } from '~~/shared/types'

// Lego-grid albums seeded from content/albums/*.md.
export const contentAlbums = sqliteTable('content_albums', {
  id: text('id').primaryKey(),
  // Human-readable URL slug. Decoupled from `id` (which is the immutable R2
  // folder key) so albums can be renamed without moving any stored objects.
  slug: text('slug').notNull().unique().default(''),
  title: text('title').notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  dateEnd: text('date_end'),
  published: text('published').notNull(),
  visibility: text('visibility').$type<ContentStatus>().notNull().default('public'),
  location: text('location'),
  excerpt: text('excerpt').notNull(),
  style: text('style').$type<AlbumStyle>().notNull(),
  placement: text('placement').$type<Placement>().notNull(),
  coverSrc: text('cover_src').notNull().default(''),
  rows: text('rows_json', { mode: 'json' }).$type<AlbumRow[]>().notNull().default(sql`'[]'`),
  textDefaults: text('text_defaults_json', { mode: 'json' }).$type<{ align?: 'left' | 'center' | 'right', font?: 'serif' | 'sans' }>(),
  createdAt,
  updatedAt
})

// Block-based editorial posts.
export const contentPosts = sqliteTable('content_posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  tag: text('tag').notNull(),
  date: text('date').notNull(),
  published: text('published').notNull(),
  visibility: text('visibility').$type<ContentStatus>().notNull().default('public'),
  image: text('image').notNull(),
  excerpt: text('excerpt').notNull(),
  blocks: text('body', { mode: 'json' }).$type<PostBlock[]>().notNull().default(sql`'[]'`),
  heroStyle: text('hero_style').$type<HeroStyle>().notNull().default('standard'),
  author: text('author').notNull().default(''),
  authorBio: text('author_bio').notNull().default(''),
  authorAvatar: text('author_avatar').notNull().default(''),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  createdAt,
  updatedAt
})

export const adminAuditLogs = sqliteTable('admin_audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorId: integer('actor_id'),
  actorEmail: text('actor_email').notNull(),
  actorName: text('actor_name'),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  entityTitle: text('entity_title'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default(sql`'{}'`),
  createdAt
})

export const uploadSessions = sqliteTable('upload_sessions', {
  id: text('id').primaryKey(),
  actorId: integer('actor_id').notNull(),
  prefix: text('prefix').notNull(),
  createdAt,
  updatedAt
})

export const uploadSessionItems = sqliteTable('upload_session_items', {
  sessionId: text('session_id')
    .notNull()
    .references(() => uploadSessions.id, { onDelete: 'cascade' }),
  id: text('id').notNull(),
  position: integer('position').notNull().default(0),
  name: text('name').notNull(),
  hash: text('hash').notNull(),
  ext: text('ext').notNull(),
  r2Key: text('r2_key').notNull(),
  size: integer('size').notNull().default(0),
  type: text('type').notNull(),
  status: text('status').notNull(),
  error: text('error')
}, table => [
  primaryKey({ columns: [table.sessionId, table.id] }),
  index('upload_session_items_session_idx').on(table.sessionId)
])

export const r2DeleteSessions = sqliteTable('r2_delete_sessions', {
  id: text('id').primaryKey(),
  actorId: integer('actor_id').notNull(),
  force: integer('force', { mode: 'boolean' }).notNull().default(false),
  createdAt,
  updatedAt
})

export const r2DeleteSessionItems = sqliteTable('r2_delete_session_items', {
  sessionId: text('session_id')
    .notNull()
    .references(() => r2DeleteSessions.id, { onDelete: 'cascade' }),
  key: text('object_key').notNull(),
  position: integer('position').notNull().default(0),
  status: text('status').notNull(),
  referenced: integer('referenced', { mode: 'boolean' }).notNull().default(false),
  error: text('error')
}, table => [
  primaryKey({ columns: [table.sessionId, table.key] }),
  index('r2_delete_session_items_session_idx').on(table.sessionId)
])

// Soft-delete "trash can" for R2 images. A row here means the object has been
// removed from active use (its live references are scrubbed) but the underlying
// R2 object is kept in place, so it can be restored or purged later. The admin
// inventory hides any key present in this table; the trash view lists them.
export const r2Trash = sqliteTable('r2_trash', {
  key: text('object_key').primaryKey(),
  contentType: text('content_type'),
  size: integer('size'),
  // Whether the image was still referenced by a live surface when trashed
  // (i.e. it was a forced delete whose references we scrubbed).
  referenced: integer('referenced', { mode: 'boolean' }).notNull().default(false),
  // Snapshot of which reference kinds pointed at it, for the trash UI/audit.
  references: text('references_json', { mode: 'json' }).$type<Record<string, boolean>>(),
  deletedBy: integer('deleted_by'),
  deletedByEmail: text('deleted_by_email'),
  deletedByName: text('deleted_by_name'),
  deletedAt: integer('deleted_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
}, table => [
  index('r2_trash_deleted_at_idx').on(table.deletedAt)
])
