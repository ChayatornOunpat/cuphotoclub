import { desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return db
    .select({
      id: schema.posts.id,
      slug: schema.posts.slug,
      title: schema.posts.title,
      excerpt: schema.posts.excerpt,
      coverR2Key: schema.posts.coverR2Key,
      status: schema.posts.status,
      publishedAt: schema.posts.publishedAt,
      createdAt: schema.posts.createdAt,
      updatedAt: schema.posts.updatedAt
    })
    .from(schema.posts)
    .orderBy(desc(schema.posts.createdAt))
})
