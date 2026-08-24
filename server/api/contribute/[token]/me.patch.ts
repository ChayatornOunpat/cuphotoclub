import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  // Empty string clears it — that is how someone chooses to be anonymous again.
  displayName: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(200).optional()
})

// Save the contributor's name / contact. Creates the identity if this is their
// first action, so typing a name before uploading works and hands them a code.
//
// Attribution lives on the contributor, not on each photo: changing it here
// re-credits their whole batch rather than needing 40 edits.
// ensureContributor() below INSERTS when the caller has no cookie, so an
// unthrottled loop here mints a contributor row per request — the D1 shape of
// the KV write-quota outage this project has already lived through.
const SAVE_LIMIT = 60
const SAVE_WINDOW_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireOpenLink(token)

  if (!(await rateLimit(`contrib-me:${clientIp(event)}`, SAVE_LIMIT, SAVE_WINDOW_MS))) {
    throw createError({ statusCode: 429, message: 'บันทึกถี่เกินไป กรุณารอสักครู่' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'ข้อมูลไม่ถูกต้อง' })

  const contributor = await ensureContributor(event, link)
  const displayName = result.data.displayName?.trim() || null
  const contact = result.data.contact?.trim() || null

  if (link.requireName && !displayName) {
    throw createError({ statusCode: 400, message: 'กิจกรรมนี้ต้องระบุชื่อผู้ถ่าย' })
  }

  await db
    .update(schema.eventContributors)
    .set({ displayName, contact, lastSeenAt: new Date() })
    .where(eq(schema.eventContributors.id, contributor.id))

  const code = await sessionClaimCode(event, link.id)
  return {
    ok: true,
    me: {
      displayName,
      contact,
      code: code ? formatClaimCode(code) : null,
      used: await contributorPhotoCount(contributor.id),
      remaining: await remainingForContributor(link, contributor.id)
    }
  }
})
