import { desc, eq, sql } from 'drizzle-orm'
import type { Post, PostInput, PostBlock, HeroStyle } from '~~/shared/types'

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

type PostRow = typeof schema.contentPosts.$inferSelect

function rowToPost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title,
    tag: row.tag,
    date: row.date,
    published: row.published,
    image: row.image,
    excerpt: row.excerpt,
    heroStyle: (row.heroStyle || 'standard') as HeroStyle,
    author: row.author || undefined,
    authorBio: row.authorBio || undefined,
    authorAvatar: row.authorAvatar || undefined,
    blocks: (row.blocks ?? []) as PostBlock[]
  }
}

async function writePost(post: Post): Promise<void> {
  const now = new Date()
  const values = {
    id: post.id,
    title: post.title,
    tag: post.tag,
    date: post.date,
    published: post.published,
    image: post.image,
    excerpt: post.excerpt,
    blocks: post.blocks,
    heroStyle: post.heroStyle ?? 'standard',
    author: post.author ?? '',
    authorBio: post.authorBio ?? '',
    authorAvatar: post.authorAvatar ?? '',
    updatedAt: now
  }

  await db
    .insert(schema.contentPosts)
    .values(values)
    .onConflictDoUpdate({
      target: schema.contentPosts.id,
      set: {
        title: values.title,
        tag: values.tag,
        date: values.date,
        published: values.published,
        image: values.image,
        excerpt: values.excerpt,
        blocks: values.blocks,
        heroStyle: values.heroStyle,
        author: values.author,
        authorBio: values.authorBio,
        authorAvatar: values.authorAvatar,
        updatedAt: now
      }
    })
}

let seedPromise: Promise<void> | null = null
function seedIfEmpty(): Promise<void> {
  if (!seedPromise) {
    seedPromise = (async () => {
      const [{ count } = { count: 0 }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.contentPosts)
      if (count > 0) return
      if (realDataOnly()) return

      for (const post of seed) {
        await db
          .insert(schema.contentPosts)
          .values({
            id: post.id,
            title: post.title,
            tag: post.tag,
            date: post.date,
            published: post.published,
            image: post.image,
            excerpt: post.excerpt,
            blocks: post.blocks,
            heroStyle: post.heroStyle ?? 'standard',
            author: post.author ?? '',
            authorBio: post.authorBio ?? '',
            authorAvatar: post.authorAvatar ?? ''
          })
          .onConflictDoNothing({ target: schema.contentPosts.id })
      }
    })().catch((err) => {
      seedPromise = null
      throw err
    })
  }
  return seedPromise
}

export const postStore = {
  async list(): Promise<Post[]> {
    await seedIfEmpty()
    const rows = await db
      .select()
      .from(schema.contentPosts)
      .orderBy(desc(schema.contentPosts.published))
    const posts = rows.map(rowToPost)
    return realDataOnly() ? posts.filter(post => !containsMockMedia(post)) : posts
  },

  async get(id: string): Promise<Post | null> {
    await seedIfEmpty()
    const [row] = await db
      .select()
      .from(schema.contentPosts)
      .where(eq(schema.contentPosts.id, id))
      .limit(1)
    if (!row) return null
    const post = rowToPost(row)
    return realDataOnly() && containsMockMedia(post) ? null : post
  },

  async create(input: PostInput): Promise<Post> {
    await seedIfEmpty()
    let id = slugify(input.title) || `post-${Date.now()}`
    if (await this.get(id)) id = `${id}-${Date.now().toString(36)}`

    const post: Post = { ...input, id }
    await writePost(post)
    return post
  },

  async update(id: string, input: PostInput): Promise<Post | null> {
    await seedIfEmpty()
    if (!(await this.get(id))) return null

    const post: Post = { ...input, id }
    await writePost(post)
    return post
  },

  async remove(id: string): Promise<boolean> {
    await seedIfEmpty()
    const [existing] = await db
      .select({ id: schema.contentPosts.id })
      .from(schema.contentPosts)
      .where(eq(schema.contentPosts.id, id))
      .limit(1)
    if (!existing) return false
    await db.delete(schema.contentPosts).where(eq(schema.contentPosts.id, id))
    return true
  }
}
