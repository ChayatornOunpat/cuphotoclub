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

// Site-wide settings (nav, socials, footer, SEO defaults) as key/JSON pairs.
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value', { mode: 'json' }),
  updatedAt
})
