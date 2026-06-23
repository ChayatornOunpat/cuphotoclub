import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  caption: z.string().trim().nullable().optional(),
  alt: z.string().trim().nullable().optional(),
  photographer: z.string().trim().nullable().optional(),
  sortOrder: z.number().int().optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง', data: result.error.flatten() })

  const updates: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(result.data)) {
    if (v !== undefined) updates[k] = v
  }
  if (!Object.keys(updates).length) return { ok: true }

  await db.update(schema.photos).set(updates).where(eq(schema.photos.id, id))
  return { ok: true }
})
