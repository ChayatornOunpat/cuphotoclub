import { eq, sql } from 'drizzle-orm'

// Delete a photo collection and everything filed under it.
//
// Rows only, which is deliberate and matches how deleting an album behaves
// (albumStore.remove drops the row and leaves the objects). Trashing every
// submitted object inline is not possible inside one request: a collection
// holds up to maxTotal (2000) photos and each one would cost a blob.head plus
// trash bookkeeping against a 50-subrequest budget — the same ceiling that
// caps submissions/index.delete at 25 ids. Running out mid-loop is what
// strands objects, so this does not start.
//
// What happens to the photos instead: once these rows are gone nothing
// references those keys, so getR2DeleteReferences reports them as unreferenced
// and /admin/r2-images lists them for a chunked bulk trash. Nothing is lost,
// and the cleanup runs where it can be paged.
//
// The row deletes are all single statements with one bound parameter each, so
// the count of photos in the collection does not matter to D1's 100-param cap.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const linkId = getRouterParam(event, 'linkId') || ''

  const [link] = await db
    .select()
    .from(schema.collectionLinks)
    .where(eq(schema.collectionLinks.id, linkId))
    .limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์รวมรูป' })

  // Counted before the delete purely so the audit entry and the response can
  // say how much went — a bare "deleted" tells nobody what was in there.
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.collectionSubmissions)
    .where(eq(schema.collectionSubmissions.linkId, linkId))
  const photoCount = Number(total)

  // Explicit and child-first rather than leaning on the FK cascade, so the
  // behaviour does not depend on whether foreign keys are enforced.
  await db.delete(schema.collectionSubmissions).where(eq(schema.collectionSubmissions.linkId, linkId))
  await db.delete(schema.collectionContributors).where(eq(schema.collectionContributors.linkId, linkId))
  await db.delete(schema.collectionLinks).where(eq(schema.collectionLinks.id, linkId))

  // The cover is exactly one object, so trashing it here is bounded. Checked
  // after the row is gone so this collection is not counted as a reason to keep
  // its own cover, and reference-checked because a cover picked from the shared
  // library may still be in use somewhere else.
  let trashedCover = false
  if (link.coverR2Key) {
    const references = await getR2DeleteReferences([link.coverR2Key])
    const info = references.get(link.coverR2Key)
    if (!info || !isR2DeleteReferenced(info)) {
      const head = await blob.head(link.coverR2Key).catch(() => null)
      await addToR2Trash([{
        key: link.coverR2Key,
        contentType: head?.contentType ?? null,
        size: head?.size ?? null,
        referenced: false,
        deletedBy: actor.id,
        deletedByEmail: actor.email,
        deletedByName: actor.name ?? null
      }])
      trashedCover = true
    }
  }

  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'collection_link',
    entityId: link.id,
    entityTitle: link.label,
    metadata: { photoCount, trashedCover }
  })

  return { ok: true, photoCount, trashedCover }
})
