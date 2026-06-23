import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().email(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(1).max(5000)
})

export default defineEventHandler(async (event) => {
  // Max 5 submissions per IP per hour.
  if (!(await rateLimit(`contact:${clientIp(event)}`, 5, 60 * 60 * 1000))) {
    throw createError({ statusCode: 429, message: 'ส่งข้อความบ่อยเกินไป กรุณาลองใหม่ภายหลัง' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' })
  const d = result.data

  await db.insert(schema.contactMessages).values({
    name: d.name,
    email: d.email,
    subject: d.subject ?? null,
    message: d.message
  })

  return { ok: true }
})
