import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  nickname:   z.string().trim().min(1).max(80).optional(),
  schoolYear: z.number().int().min(1).max(4).nullable().optional(),
  position:   z.string().trim().max(100).nullable().optional(),
  instagram:  z.string().trim().max(60).nullable().optional(),
  photoR2Key: z.string().nullable().optional(),
  active:     z.boolean().optional(),
  sortOrder:  z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })
  const d = result.data

  const [row] = await db.select().from(schema.members).where(eq(schema.members.id, id)).limit(1)
  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบสมาชิก' })

  const updates: Record<string, unknown> = {}
  if (d.nickname   !== undefined) updates.nickname   = d.nickname
  if (d.schoolYear !== undefined) updates.schoolYear = d.schoolYear
  if (d.position   !== undefined) updates.position   = d.position
  if (d.instagram  !== undefined) updates.instagram  = d.instagram
  if (d.active     !== undefined) updates.active     = d.active
  if (d.sortOrder  !== undefined) updates.sortOrder  = d.sortOrder
  if (d.photoR2Key !== undefined) {
    updates.photoR2Key = d.photoR2Key
    if (row.photoR2Key && row.photoR2Key !== d.photoR2Key) {
      await blob.delete(row.photoR2Key).catch(() => {})
    }
  }

  await db.update(schema.members).set(updates).where(eq(schema.members.id, id))
  if (Object.keys(updates).length) {
    await recordAdminAudit(actor, {
      action: 'update',
      entityType: 'member',
      entityId: id,
      entityTitle: String(updates.nickname ?? row.nickname),
      metadata: {
        previousNickname: row.nickname,
        previousActive: row.active,
        nextActive: updates.active ?? row.active,
        changed: Object.keys(updates)
      }
    })
  }
  return { ok: true }
})
