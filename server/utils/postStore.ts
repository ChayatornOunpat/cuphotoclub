import type { Post, PostInput } from '~~/shared/types'
import { appDb } from './appDb'

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const seed: Post[] = [
  {
    id: 'architecture-of-light',
    title: 'The Architecture of Light: How We Learned to See',
    tag: 'Essay',
    date: 'April 2025',
    published: '2025-04-18',
    image: 'https://picsum.photos/seed/cusc_lead/1200/900',
    excerpt: 'For our annual workshop series, members gathered at dawn to study how light transforms the ordinary into something extraordinary - a lesson in patience.',
    body: 'For our annual workshop series, members gathered at dawn in Lumphini Park to study how light transforms the ordinary into something extraordinary. What followed was not a lesson in technique, but in patience and presence.\n\nWe arrived before the sun, cameras cold in our hands, and waited. The first light came slow - a grey wash, then gold catching the edges of the lake.'
  },
  {
    id: 'finding-stillness',
    title: 'Finding Stillness: Documentary Photography in Motion',
    tag: 'Workshop',
    date: 'February 2025',
    published: '2025-02-14',
    image: 'https://picsum.photos/seed/cusc03/800/550',
    excerpt: 'How slowing down changes everything you think you know about making pictures.',
    body: 'How slowing down changes everything you think you know about making pictures.\n\nDocumentary work rewards the photographer who waits, who lets a moment arrive rather than chasing it.'
  },
  {
    id: 'talking-to-the-street',
    title: 'Talking to the Street: A Conversation on Urban Photography',
    tag: 'Interview',
    date: 'December 2024',
    published: '2024-12-09',
    image: 'https://picsum.photos/seed/cusc05/800/550',
    excerpt: 'Two members sit down to discuss the ethics, instincts, and small courage of photographing strangers.',
    body: 'Two members sit down to discuss the ethics, instincts, and small courage of photographing strangers in a city that never quite holds still.'
  }
]

appDb.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    tag TEXT NOT NULL,
    date TEXT NOT NULL,
    published TEXT NOT NULL,
    image TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

function rowToPost(row: any): Post {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag,
    date: row.date,
    published: row.published,
    image: row.image,
    excerpt: row.excerpt,
    body: row.body
  }
}

function writePost(post: Post) {
  appDb.prepare(`
    INSERT INTO posts (id, title, tag, date, published, image, excerpt, body, updated_at)
    VALUES (@id, @title, @tag, @date, @published, @image, @excerpt, @body, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      tag = excluded.tag,
      date = excluded.date,
      published = excluded.published,
      image = excluded.image,
      excerpt = excluded.excerpt,
      body = excluded.body,
      updated_at = CURRENT_TIMESTAMP
  `).run(post)
}

function seedIfEmpty() {
  const count = appDb.prepare('SELECT COUNT(*) as count FROM posts').get().count
  if (count > 0) return

  const insertMany = appDb.transaction((posts: Post[]) => {
    for (const post of posts) writePost(post)
  })
  insertMany(seed)
}

export const postStore = {
  list(): Post[] {
    seedIfEmpty()
    return appDb
      .prepare('SELECT * FROM posts ORDER BY published DESC')
      .all()
      .map(rowToPost)
  },

  get(id: string): Post | null {
    seedIfEmpty()
    const row = appDb.prepare('SELECT * FROM posts WHERE id = ?').get(id)
    return row ? rowToPost(row) : null
  },

  create(input: PostInput): Post {
    seedIfEmpty()
    let id = slugify(input.title) || `post-${Date.now()}`
    if (this.get(id)) id = `${id}-${Date.now().toString(36)}`

    const post: Post = { ...input, id }
    writePost(post)
    return post
  },

  update(id: string, input: PostInput): Post | null {
    seedIfEmpty()
    if (!this.get(id)) return null

    const post: Post = { ...input, id }
    writePost(post)
    return post
  },

  remove(id: string): boolean {
    seedIfEmpty()
    const result = appDb.prepare('DELETE FROM posts WHERE id = ?').run(id)
    return result.changes > 0
  }
}

