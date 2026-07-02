import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({ images: z.array(z.string()) })

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })

  const value = result.data.images
  await db
    .insert(schema.settings)
    .values({ key: 'heroImages', value })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value, updatedAt: new Date() } })

  return { images: value }
})
