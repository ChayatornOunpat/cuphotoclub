import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const [message] = await db.select().from(schema.contactMessages).where(eq(schema.contactMessages.id, id)).limit(1)
  if (!message) throw createError({ statusCode: 404, message: 'ไม่พบข้อความ' })

  await db.delete(schema.contactMessages).where(eq(schema.contactMessages.id, id))
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'message',
    entityId: id,
    entityTitle: message.subject || message.name,
    metadata: {
      sender: message.email,
      archived: message.archived,
      read: !!message.readAt
    }
  })
  return { ok: true }
})
