import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
})

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

import type { AlbumRow, AlbumStyle, HeroStyle, Placement, PostBlock } from '~~/shared/types'

// Lego-grid albums seeded from content/albums/*.md.
export const contentAlbums = sqliteTable('content_albums', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  date: text('date').notNull(),
  published: text('published').notNull(),
  location: text('location'),
  excerpt: text('excerpt').notNull(),
  style: text('style').$type<AlbumStyle>().notNull(),
  placement: text('placement').$type<Placement>().notNull(),
  coverSrc: text('cover_src').notNull().default(''),
  rows: text('rows_json', { mode: 'json' }).$type<AlbumRow[]>().notNull().default(sql`'[]'`),
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
  image: text('image').notNull(),
  excerpt: text('excerpt').notNull(),
  blocks: text('body', { mode: 'json' }).$type<PostBlock[]>().notNull().default(sql`'[]'`),
  heroStyle: text('hero_style').$type<HeroStyle>().notNull().default('standard'),
  author: text('author').notNull().default(''),
  authorBio: text('author_bio').notNull().default(''),
  authorAvatar: text('author_avatar').notNull().default(''),
  createdAt,
  updatedAt
})
