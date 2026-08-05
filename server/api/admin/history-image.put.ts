import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  image: z.string().trim().max(1024).nullable()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid image selection' })

  const image = result.data.image || ''
  await db
    .insert(schema.settings)
    .values({ key: 'historyImage', value: image })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: image, updatedAt: new Date() } })

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'settings',
    entityId: 'historyImage',
    entityTitle: 'History image',
    metadata: { image: image || null }
  })

  return { image }
})
