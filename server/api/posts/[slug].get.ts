import { and, eq } from 'drizzle-orm'

// Public: a published post with rendered HTML body.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') || ''

  const [post] = await db
    .select()
    .from(schema.posts)
    .where(and(eq(schema.posts.slug, slug), eq(schema.posts.status, 'published')))
    .limit(1)

  if (!post) throw createError({ statusCode: 404, message: 'ไม่พบบทความ' })

  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    coverR2Key: post.coverR2Key,
    tags: post.tags,
    publishedAt: post.publishedAt,
    bodyHtml: renderMarkdown(post.body)
  }
})
