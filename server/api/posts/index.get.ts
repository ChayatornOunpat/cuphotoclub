import { desc, eq } from 'drizzle-orm'

// Public: published posts.
export default defineEventHandler(async () => {
  return db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      excerpt: schema.posts.excerpt,
      coverR2Key: schema.posts.coverR2Key,
      tags: schema.posts.tags,
      publishedAt: schema.posts.publishedAt
    })
    .from(schema.posts)
    .where(eq(schema.posts.status, 'published'))
    .orderBy(desc(schema.posts.publishedAt), desc(schema.posts.createdAt))
})
