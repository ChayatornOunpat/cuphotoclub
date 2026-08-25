import { eq } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  // Empty string clears it — that is how someone chooses to be anonymous again.
  displayName: z.string().trim().max(120).optional(),
  contact: z.string().trim().max(200).optional(),
  // Consent to being credited by the handle above. Deliberately independent of
  // displayName: giving us a way to reach you is not agreeing to a byline.
  creditHandle: z.boolean().optional(),
  // Free-text note about the batch. Empty string clears it.
  note: z.string().trim().max(2000).optional()
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
  const input = result.data

  // Only the fields actually sent are written. The page saves the note on its
  // own blur, long after the name was typed; a blanket write would null the
  // name every time. Same partial-patch shape as the admin link PATCH.
  const displayName = input.displayName !== undefined
    ? (input.displayName.trim() || null)
    : contributor.displayName
  const contact = input.contact !== undefined
    ? (input.contact.trim() || null)
    : contributor.contact
  const creditHandle = input.creditHandle !== undefined
    ? input.creditHandle
    : Boolean(contributor.creditHandle)
  const note = input.note !== undefined
    ? (input.note.trim() || null)
    : contributor.note

  if (link.requireName && !displayName) {
    throw createError({ statusCode: 400, message: 'ลิงก์นี้ต้องระบุชื่อผู้ถ่าย' })
  }

  await db
    .update(schema.collectionContributors)
    .set({ displayName, contact, creditHandle, note, lastSeenAt: new Date() })
    .where(eq(schema.collectionContributors.id, contributor.id))

  const code = await sessionClaimCode(event, link.id)
  return {
    ok: true,
    me: {
      displayName,
      contact,
      creditHandle,
      note,
      code: code ? formatClaimCode(code) : null,
      used: await contributorPhotoCount(contributor.id),
      remaining: await remainingForContributor(link, contributor.id)
    }
  }
})
