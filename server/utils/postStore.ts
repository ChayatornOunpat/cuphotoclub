import type { Post, PostInput, PostBlock, HeroStyle } from '~~/shared/types'
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
    blocks: [
      { id: '1', type: 'lead', content: 'For our annual workshop series, members gathered at dawn in Lumphini Park to study how light transforms the ordinary into something extraordinary. What followed was not a lesson in technique, but in patience and presence.' },
      { id: '2', type: 'text', content: 'We arrived before the sun, cameras cold in our hands, and waited. The first light came slow — a grey wash, then gold catching the edges of the lake.' },
      { id: '3', type: 'pullquote', content: 'The photograph is not made by the camera. It is made by the interval between what you expect and what arrives.' },
      { id: '4', type: 'text', content: 'By the third hour, everyone had stopped checking their screens. The cameras came up slowly, deliberately. The photographs from that morning were the best work any of us had made all year.' }
    ]
  },
  {
    id: 'finding-stillness',
    title: 'Finding Stillness: Documentary Photography in Motion',
    tag: 'Workshop',
    date: 'February 2025',
    published: '2025-02-14',
    image: 'https://picsum.photos/seed/cusc03/800/550',
    excerpt: 'How slowing down changes everything you think you know about making pictures.',
    blocks: [
      { id: '1', type: 'lead', content: 'How slowing down changes everything you think you know about making pictures.' },
      { id: '2', type: 'text', content: 'Documentary work rewards the photographer who waits, who lets a moment arrive rather than chasing it.' },
      { id: '3', type: 'inset', content: 'Workshop notes from our February session at Lumphini Park. Attendance: 14 members. Duration: 3 hours.' }
    ]
  },
  {
    id: 'talking-to-the-street',
    title: 'Talking to the Street: A Conversation on Urban Photography',
    tag: 'Interview',
    date: 'December 2024',
    published: '2024-12-09',
    image: 'https://picsum.photos/seed/cusc05/800/550',
    excerpt: 'Two members sit down to discuss the ethics, instincts, and small courage of photographing strangers.',
    blocks: [
      { id: '1', type: 'text', content: 'Two members sit down to discuss the ethics, instincts, and small courage of photographing strangers in a city that never quite holds still.' },
      { id: '2', type: 'qanda', question: 'How do you approach a stranger with a camera?', answer: 'I don\'t think about it as approaching a stranger. I think about it as entering a space. The camera is secondary — your presence, your stillness, your patience is what determines the photograph.' },
      { id: '3', type: 'divider' },
      { id: '4', type: 'text', content: 'The conversation continued for two hours. What emerged was not a set of rules, but a shared sensibility — that good street photography is fundamentally about respect.' }
    ]
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

// Additive migrations — safe to run repeatedly
for (const col of [
  `ALTER TABLE posts ADD COLUMN hero_style TEXT NOT NULL DEFAULT 'standard'`,
  `ALTER TABLE posts ADD COLUMN author TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE posts ADD COLUMN author_bio TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE posts ADD COLUMN author_avatar TEXT NOT NULL DEFAULT ''`,
]) {
  try { appDb.exec(col) } catch {}
}

function parseBlocks(body: string): PostBlock[] {
  try {
    const parsed = JSON.parse(body)
    if (Array.isArray(parsed)) return parsed as PostBlock[]
  } catch {}
  // Legacy plain-text body: wrap as a single text block
  return [{ id: '1', type: 'text', content: String(body) }]
}

function rowToPost(row: any): Post {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag,
    date: row.date,
    published: row.published,
    image: row.image,
    excerpt: row.excerpt,
    heroStyle: (row.hero_style || 'standard') as HeroStyle,
    author: row.author || undefined,
    authorBio: row.author_bio || undefined,
    authorAvatar: row.author_avatar || undefined,
    blocks: parseBlocks(row.body),
  }
}

function writePost(post: Post) {
  appDb.prepare(`
    INSERT INTO posts (id, title, tag, date, published, image, excerpt, body, hero_style, author, author_bio, author_avatar, updated_at)
    VALUES (@id, @title, @tag, @date, @published, @image, @excerpt, @body, @hero_style, @author, @author_bio, @author_avatar, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      tag = excluded.tag,
      date = excluded.date,
      published = excluded.published,
      image = excluded.image,
      excerpt = excluded.excerpt,
      body = excluded.body,
      hero_style = excluded.hero_style,
      author = excluded.author,
      author_bio = excluded.author_bio,
      author_avatar = excluded.author_avatar,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    id: post.id,
    title: post.title,
    tag: post.tag,
    date: post.date,
    published: post.published,
    image: post.image,
    excerpt: post.excerpt,
    body: JSON.stringify(post.blocks),
    hero_style: post.heroStyle ?? 'standard',
    author: post.author ?? '',
    author_bio: post.authorBio ?? '',
    author_avatar: post.authorAvatar ?? '',
  })
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
