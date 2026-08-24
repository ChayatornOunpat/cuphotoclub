import { z } from 'zod'

const bodySchema = z.object({
  code: z.string().min(1).max(64)
})

// Adopt an existing contributor identity on another device.
//
// This is a guessing oracle, so it is rate limited per IP. Putting that on KV is
// safe despite the free-plan write quota that has taken the site down before:
// rateLimit() returns false from its `count >= max` branch *before* reaching
// kv.set(), so a brute-forcer costs at most CLAIM_ATTEMPTS writes per hour.
const CLAIM_ATTEMPTS = 10
const CLAIM_WINDOW_MS = 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  // requireLink, not requireOpenLink: adopting an identity grants no writes,
  // and the page invites exactly this on a closed link.
  const link = await requireLink(token)

  // failClosed: this is the only guard on guessing a 50-bit code, so a KV
  // outage must not quietly turn it off.
  if (!(await rateLimit(`contrib-claim:${clientIp(event)}`, CLAIM_ATTEMPTS, CLAIM_WINDOW_MS, { failClosed: true }))) {
    throw createError({ statusCode: 429, message: 'ลองใส่รหัสบ่อยเกินไป กรุณารอสักครู่' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const contributor = await claimByCode(event, link, result.data.code)
  // Same response for a malformed code and a well-formed one that matches
  // nothing — no reason to tell a guesser which half they got right.
  if (!contributor) throw createError({ statusCode: 404, message: 'ไม่พบรหัสนี้' })

  return {
    ok: true,
    me: {
      displayName: contributor.displayName,
      contact: contributor.contact,
      used: await contributorPhotoCount(contributor.id),
      remaining: await remainingForContributor(link, contributor.id)
    }
  }
})
