// Let go of this browser's contributor identity for one collection — the "not
// me" half of the returning-visitor screen (see docs/event-photo-submissions.md
// §2). Phones get handed around at an event and the cookie outlives the person
// holding it, so there has to be a way out that is not "clear your cookies".
//
// Nothing is deleted. The contributor row, their photos and their claim code all
// stay; only this browser's pointer at them goes, and the code brings them back.
// That also means the plaintext code disappears with the cookie entry, which is
// why the page shows it one last time before offering this.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  // requireLink, not requireOpenLink: forgetting an identity writes nothing to
  // the collection, and a closed link is exactly where an old cookie lingers.
  const link = await requireLink(token)

  // No rate limit. This touches the sealed cookie and nothing else — no row is
  // created, no D1 or KV write happens, so there is no quota to burn through.
  await forgetContributor(event, link.id)

  return { ok: true }
})
