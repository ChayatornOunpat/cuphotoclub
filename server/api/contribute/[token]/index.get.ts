// Public: everything the contribute page needs to render itself.
//
// Deliberately does NOT create a contributor. A GET happens for every crawler,
// link preview and idle tab; minting a row (and a claim code) here would fill the
// table with identities nobody ever uses. The row is created on the first action
// that needs one — dropping files, or saving a name.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireLink(token)

  const contributor = await currentContributor(event, link)
  const open = isLinkOpen(link)

  return {
    link: {
      label: link.label,
      description: link.description,
      // Null for most collections — the page draws its own header treatment
      // rather than substituting a stand-in image.
      coverKey: link.coverR2Key,
      // Display-only. Serialised as ISO so the page can format it in the
      // visitor's locale rather than the server's.
      eventDate: link.eventDate ? link.eventDate.toISOString() : null,
      location: link.location,
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
