import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [post] = await db.select().from(schema.posts).where(eq(schema.posts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, message: 'ไม่พบบทความ' })
  return post
})
