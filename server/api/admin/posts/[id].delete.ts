import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [post] = await db.select({ coverR2Key: schema.posts.coverR2Key }).from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, message: 'ไม่พบบทความ' })

  if (post.coverR2Key) await blob.delete(post.coverR2Key).catch(() => {})
  await db.delete(schema.posts).where(eq(schema.posts.id, id))
  return { ok: true }
})
