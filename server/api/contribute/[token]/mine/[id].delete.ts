import { and, eq } from 'drizzle-orm'

// Withdraw one of your own photos, while the link is open.
//
// Keys are content-addressed, so two people who sent the same photo share one R2
// object. Removing this person's row must never pull the object out from under
// anyone else — so the object is only trashed once nothing at all still points
// at it, and even then it goes to the restorable trash rather than blob.delete().
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireOpenLink(token)
  const contributor = await requireContributor(event, link)
  const id = getRouterParam(event, 'id') || ''

  const removed = await db
    .delete(schema.collectionSubmissions)
    .where(and(
      eq(schema.collectionSubmissions.id, id),
      eq(schema.collectionSubmissions.contributorId, contributor.id)
    ))
    .returning({ r2Key: schema.collectionSubmissions.r2Key })

  const key = removed[0]?.r2Key
  if (!key) throw createError({ statusCode: 404, message: 'ไม่พบรูปนี้' })

  // Recomputed *after* the row is gone, so this photo's own submission does not
  // count as a reason to keep the object.
  const references = await getR2DeleteReferences([key])
  const info = references.get(key)
  if (!info || !isR2DeleteReferenced(info)) {
    const head = await blob.head(key).catch(() => null)
    await addToR2Trash([{
      key,
      contentType: head?.contentType ?? null,
      size: head?.size ?? null,
      referenced: false,
      deletedByName: 'contributor'
    }])
  }

  return { ok: true, remaining: await remainingForContributor(link, contributor.id) }
})
