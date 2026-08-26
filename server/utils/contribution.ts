import type { H3Event } from 'h3'
import { and, eq, sql } from 'drizzle-orm'

// Photo collections — see docs/event-photo-submissions.md. Standalone: a
// collection has no relationship to events/activities.
//
// Two identities meet here and must never be confused:
//   • admins,        via nuxt-auth-utils' user session (requireAdmin)
//   • contributors,  via the separate cu_contrib cookie below
// requireAdmin() rejects a session with no id/email/role, but a bare
// requireUserSession() would accept one — so contributors are kept in their own
// cookie rather than the User session, and that class of mistake cannot be made.

export type CollectionLink = typeof schema.collectionLinks.$inferSelect
export type CollectionContributor = typeof schema.collectionContributors.$inferSelect

const CONTRIBUTOR_COOKIE = 'cu_contrib'

// ── Link tokens ─────────────────────────────────────────────────────────────

// 16 random bytes as base64url — 22 chars, and every character survives
// sanitizeUploadPrefix() so the token can be part of an R2 key.
export function generateLinkToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// Uploads are written here and nowhere else. /images/ hard-404s this prefix, so
// nothing a participant sends is publicly fetchable until an admin copies it out.
//
// Scoped per contributor because the key is derived from a client-supplied
// hash that the server never verifies. Without the contributor segment, one
// person could pre-seed a key with arbitrary bytes and have it silently
// adopted by whoever legitimately uploads the file with that hash. Cross-user
// dedupe is the cost; a poisoned public album is what it buys off.
export function contributionPrefix(
  link: Pick<CollectionLink, 'id'>,
  contributorId: string
) {
  return `contributions/${link.id}/${contributorId}`
}

// ── Claim codes ─────────────────────────────────────────────────────────────

// Crockford base32: no I, L, O or U. People read these off one screen and type
// them into another, so ambiguous glyphs are the whole failure mode.
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
const CODE_LENGTH = 10
const CODE_PREFIX = 'CUPC'

// 10 chars x 5 bits = 50 bits. `byte & 31` is exactly uniform over 32 symbols
// (256 / 32 = 8), so there is no modulo bias to correct for.
export function generateClaimCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH))
  let code = ''
  for (const byte of bytes) code += CROCKFORD[byte & 31]
  return code
}

export function formatClaimCode(code: string) {
  return `${CODE_PREFIX}-${code.slice(0, 5)}-${code.slice(5, 10)}`
}

// Accepts whatever someone actually types: lowercase, spaces, missing dashes,
// with or without the prefix, and the classic misreadings. `U` is not in the
// alphabet, so a real code can never begin with "CUPC" and stripping the prefix
// is unambiguous.
export function normalizeClaimCode(input: string) {
  const cleaned = String(input || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  const body = cleaned.startsWith(CODE_PREFIX) ? cleaned.slice(CODE_PREFIX.length) : cleaned
  const mapped = body.replace(/[IL]/g, '1').replace(/O/g, '0')
  return mapped.length === CODE_LENGTH && [...mapped].every(char => CROCKFORD.includes(char))
    ? mapped
    : ''
}

// The code is a bearer credential, so only its hash is stored. The plaintext
// lives in the owner's own sealed cookie so the page can redisplay it to them.
export async function hashClaimCode(normalized: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

// ── Links ───────────────────────────────────────────────────────────────────

export async function getUploadLink(token: string) {
  if (!token) return null
  const [row] = await db
    .select()
    .from(schema.collectionLinks)
    .where(eq(schema.collectionLinks.id, token))
    .limit(1)
  return row ?? null
}

export function isLinkOpen(link: CollectionLink) {
  if (link.status !== 'open') return false
  if (link.expiresAt && link.expiresAt.getTime() <= Date.now()) return false
  return true
}

// Reading a closed link is allowed — the page goes read-only rather than dead,
// so someone returning to an old link sees what they sent instead of a 404.
export async function requireLink(token: string) {
  const link = await getUploadLink(token)
  if (!link) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์อัปโหลด' })
  return link
}

// Anything that writes goes through here: uploading, editing, removing.
export async function requireOpenLink(token: string) {
  const link = await requireLink(token)
  if (!isLinkOpen(link)) {
    throw createError({ statusCode: 403, message: 'ปิดรับรูปภาพสำหรับลิงก์นี้แล้ว' })
  }
  return link
}

// ── Contributor session ─────────────────────────────────────────────────────

// Keyed by link so one browser can contribute to several collections without
// the identities overwriting each other.
interface ContributorSessionData {
  links?: Record<string, { contributorId: string, code: string }>
}

function contributorSession(event: H3Event) {
  return useSession<ContributorSessionData>(event, {
    name: CONTRIBUTOR_COOKIE,
    password: useRuntimeConfig(event).session.password,
    cookie: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    }
  })
}

async function loadContributor(linkId: string, contributorId: string) {
  const [row] = await db
    .select()
    .from(schema.collectionContributors)
    .where(and(
      eq(schema.collectionContributors.id, contributorId),
      eq(schema.collectionContributors.linkId, linkId)
    ))
    .limit(1)
  return row ?? null
}

// The contributor this browser already is on this link, or null.
export async function currentContributor(event: H3Event, link: CollectionLink) {
  const session = await contributorSession(event)
  const entry = session.data.links?.[link.id]
  if (!entry?.contributorId) return null
  const row = await loadContributor(link.id, entry.contributorId)
  // Row gone (link deleted and recreated, admin cleanup) — drop the stale entry
  // rather than leaving the cookie pointing at nothing.
  if (!row) {
    await forgetContributor(event, link.id)
    return null
  }
  return row
}

export async function requireContributor(event: H3Event, link: CollectionLink) {
  const contributor = await currentContributor(event, link)
  if (!contributor) {
    throw createError({ statusCode: 401, message: 'ไม่พบเซสชันผู้ส่งรูป กรุณาเริ่มใหม่หรือใส่รหัสของคุณ' })
  }
  return contributor
}

async function rememberContributor(event: H3Event, linkId: string, contributorId: string, code: string) {
  const session = await contributorSession(event)
  await session.update(data => ({
    links: { ...(data.links ?? {}), [linkId]: { contributorId, code } }
  }))
}

// Drop this browser's claim on one link. The contributor row and everything
// they sent are untouched — only the cookie entry goes, so the identity is
// still reachable with its claim code. Used both when the row has vanished
// underneath a stale cookie and when someone hands the page to the next person.
export async function forgetContributor(event: H3Event, linkId: string) {
  const session = await contributorSession(event)
  await session.update((data) => {
    const entries = Object.entries(data.links ?? {}).filter(([key]) => key !== linkId)
    return { links: Object.fromEntries(entries) }
  })
}

// The plaintext claim code for this browser's contributor, if it minted it.
// Absent after adopting an identity from another device via a code they typed —
// in that case they already have the code in hand.
export async function sessionClaimCode(event: H3Event, linkId: string) {
  const session = await contributorSession(event)
  return session.data.links?.[linkId]?.code ?? null
}

// Create the contributor on first contact so the claim code exists before the
// first upload finishes — closing the tab mid-upload must not orphan a batch.
//
// Two requests racing a first visit can each insert a contributor row (nothing
// constrains them to one) and the cookie keeps whichever wrote last. The loser
// is an unreachable row: its claim code plaintext was never persisted, so it can
// never be claimed or reused, and it holds zero submissions. Bounded by how
// often a browser double-fires its very first manifest call; not worth a schema
// change or a D1 transaction.
export async function ensureContributor(event: H3Event, link: CollectionLink) {
  const existing = await currentContributor(event, link)
  if (existing) return existing

  const code = generateClaimCode()
  const [created] = await db
    .insert(schema.collectionContributors)
    .values({
      id: crypto.randomUUID(),
      linkId: link.id,
      codeHash: await hashClaimCode(code),
      lastSeenAt: new Date()
    })
    .returning()

  if (!created) throw createError({ statusCode: 500, message: 'เริ่มเซสชันไม่สำเร็จ' })
  await rememberContributor(event, link.id, created.id, code)
  return created
}

// Adopt an existing identity on a new device. Callers must rate limit first:
// this is a guessing oracle.
export async function claimByCode(event: H3Event, link: CollectionLink, rawCode: string) {
  const normalized = normalizeClaimCode(rawCode)
  if (!normalized) return null

  const [row] = await db
    .select()
    .from(schema.collectionContributors)
    .where(and(
      eq(schema.collectionContributors.linkId, link.id),
      eq(schema.collectionContributors.codeHash, await hashClaimCode(normalized))
    ))
    .limit(1)

  if (!row) return null
  await rememberContributor(event, link.id, row.id, normalized)
  await db
    .update(schema.collectionContributors)
    .set({ lastSeenAt: new Date() })
    .where(eq(schema.collectionContributors.id, row.id))
  return row
}

// ── Caps ────────────────────────────────────────────────────────────────────

export async function contributorPhotoCount(contributorId: string) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.collectionSubmissions)
    .where(eq(schema.collectionSubmissions.contributorId, contributorId))
  return Number(row?.total ?? 0)
}

// Re-sending a photo this person already has is not a new submission (the
// unique index makes the insert a no-op), so it must not be counted against
// their cap either.
export async function contributorOwnsKey(contributorId: string, r2Key: string) {
  const [row] = await db
    .select({ id: schema.collectionSubmissions.id })
    .from(schema.collectionSubmissions)
    .where(and(
      eq(schema.collectionSubmissions.contributorId, contributorId),
      eq(schema.collectionSubmissions.r2Key, r2Key)
    ))
    .limit(1)
  return Boolean(row)
}

export async function linkPhotoCount(linkId: string) {
  const [row] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.collectionSubmissions)
    .where(eq(schema.collectionSubmissions.linkId, linkId))
  return Number(row?.total ?? 0)
}

// How many more this person may send. Counted in D1 rather than KV on purpose:
// the KV rate limiter writes on every call, and per-file limiting would burn the
// free-plan write quota that has taken the whole site down before.
export async function remainingForContributor(link: CollectionLink, contributorId: string) {
  const [mine, total] = await Promise.all([
    contributorPhotoCount(contributorId),
    linkPhotoCount(link.id)
  ])
  return Math.max(0, Math.min(link.maxPerContributor - mine, link.maxTotal - total))
}

// The per-photo byte ceiling actually enforced on the server. A link can ask for
// less than MAX_UPLOAD_BYTES but never more.
export function linkMaxBytes(link: CollectionLink) {
  return Math.min(link.maxBytesPerPhoto || MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES)
}
