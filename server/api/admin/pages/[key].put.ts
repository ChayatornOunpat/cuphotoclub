import { z } from 'zod'

const bodySchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const key = getRouterParam(event, 'key') || ''

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })
  const data = result.data

  await db
    .insert(schema.pages)
    .values({ key, title: data.title, body: data.body ?? '', updatedBy: actor.id })
    .onConflictDoUpdate({
      target: schema.pages.key,
      set: { title: data.title, body: data.body ?? '', updatedBy: actor.id, updatedAt: new Date() }
    })

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'page',
    entityId: key,
    entityTitle: data.title,
    metadata: {
      key
    }
  })

  return { ok: true }
})
