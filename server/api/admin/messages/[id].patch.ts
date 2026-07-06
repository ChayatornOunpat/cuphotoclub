import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  read: z.boolean().optional(),
  archived: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const data = result.data

  const [message] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, id)).limit(1)
  if (!message) throw createError({ statusCode: 404, message: 'ไม่พบข้อความ' })

  const updates: Record<string, unknown> = {}
  if (data.read === true) updates.readAt = new Date()
  if (data.read === false) updates.readAt = null
  if (data.archived !== undefined) updates.archived = data.archived
  if (!Object.keys(updates).length) return { ok: true }

  await db.update(schema.contactMessages).set(updates).where(eq(schema.contactMessages.id, id))
  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'message',
    entityId: id,
    entityTitle: message.subject || message.name,
    metadata: {
      sender: message.email,
      previousArchived: message.archived,
      nextArchived: updates.archived ?? message.archived,
      read: data.read
    }
  })
  return { ok: true }
})
