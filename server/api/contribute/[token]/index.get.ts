import { eq } from 'drizzle-orm'

// Public: everything the contribute page needs to render itself.
//
// Deliberately does NOT create a contributor. A GET happens for every crawler,
// link preview and idle tab; minting a row (and a claim code) here would fill the
// table with identities nobody ever uses. The row is created on the first action
// that needs one — dropping files, or saving a name.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireLink(token)

  const [ev] = await db
    .select({
      title: schema.events.title,
      slug: schema.events.slug,
      eventDate: schema.events.eventDate
    })
    .from(schema.events)
    .where(eq(schema.events.id, link.eventId))
    .limit(1)

  const contributor = await currentContributor(event, link)
  const open = isLinkOpen(link)

  return {
    link: {
      label: link.label,
      open,
      requireName: link.requireName,
      maxPerContributor: link.maxPerContributor,
      // The uploader's compression props. The participant sees no control for
      // these — the admin decided them on the link.
      compress: link.compress,
      compressMaxDim: link.compressMaxDim,
      compressQuality: link.compressQuality,
      maxBytesPerPhoto: linkMaxBytes(link),
      expiresAt: link.expiresAt
    },
    event: ev ?? null,
    me: contributor
      ? {
          displayName: contributor.displayName,
          contact: contributor.contact,
          // Only present for the browser that minted it; someone who arrived by
          // typing a code already has it in hand.
          code: (await sessionClaimCode(event, link.id).then(code => code && formatClaimCode(code))) || null,
          used: await contributorPhotoCount(contributor.id),
          remaining: open ? await remainingForContributor(link, contributor.id) : 0
        }
      : null
  }
})
