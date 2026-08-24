import { eq } from 'drizzle-orm'

// The Instagram / Facebook path: hand the admin the original file.
//
// Marks the photo as used ('external') so the pool can show at a glance what has
// already been taken out, without pretending that constitutes any kind of
// control over where it ends up.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''

  const [row] = await db
    .select({
      r2Key: schema.collectionSubmissions.r2Key,
      type: schema.collectionSubmissions.type,
      publishedTo: schema.collectionSubmissions.publishedTo,
      displayName: schema.collectionContributors.displayName
    })
    .from(schema.collectionSubmissions)
    .innerJoin(
      schema.collectionContributors,
      eq(schema.collectionSubmissions.contributorId, schema.collectionContributors.id)
    )
    .where(eq(schema.collectionSubmissions.id, id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Submission not found.' })

  // Only a deliberate click carries ?confirm=1. A GET that mutates on every
  // request lets a browser prefetch, or a link scanner, silently mark photos
  // as used.
  const confirmed = String(getQuery(event).confirm || '') === '1'
  // Don't overwrite a real publish target with 'external' — a photo can be both
  // in an album and posted to Instagram, and the album is the more useful record.
  if (confirmed && !row.publishedTo) {
    await db
      .update(schema.collectionSubmissions)
      .set({ publishedTo: 'external', publishedAt: new Date() })
      .where(eq(schema.collectionSubmissions.id, id))
    await recordAdminAudit(actor, {
      action: 'download',
      entityType: 'collection_submission',
      entityId: id,
      entityTitle: row.displayName || 'anonymous',
      metadata: { r2Key: row.r2Key }
    })
  }

  const ext = row.r2Key.split('.').pop() || 'jpg'
  const credit = (row.displayName || 'anonymous').replace(/[^\w-]+/g, '-').slice(0, 40)
  setHeader(event, 'Cache-Control', 'private, no-store')
  setHeader(event, 'Content-Disposition', `attachment; filename="${credit}-${id.slice(0, 8)}.${ext}"`)
  return blob.serve(event, row.r2Key)
})
