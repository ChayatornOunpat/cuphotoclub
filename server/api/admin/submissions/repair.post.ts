import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

// Put approved photos back that the album no longer shows.
//
// This is the repair for the one case the two-facts model deliberately allows:
// a photo was approved, then removed from the album canvas — by an editor
// tidying the layout, or by a rows write that lost a race with a concurrent
// canvas save. Neither un-decides it, so the pool reports the divergence and
// this puts the album back in step with the decisions.
//
// Bounded per call: each missing photo may need a blob.head and a copy, and the
// pool page calls this repeatedly until `remaining` is 0.
const MAX_PER_RUN = 10

const bodySchema = z.object({ linkId: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid payload.' })

  const [link] = await db
    .select()
    .from(schema.collectionLinks)
    .where(eq(schema.collectionLinks.id, result.data.linkId))
    .limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์รวมรูป' })

  const album = await linkedAlbum(link.albumId)
  if (!album) throw createError({ statusCode: 409, message: 'This collection has no album linked.' })

  const approved = await db
    .select({
      id: schema.collectionSubmissions.id,
      r2Key: schema.collectionSubmissions.r2Key,
      caption: schema.collectionSubmissions.caption,
      albumKey: schema.collectionSubmissions.albumKey,
      displayName: schema.collectionContributors.displayName,
      contact: schema.collectionContributors.contact,
      creditHandle: schema.collectionContributors.creditHandle
    })
    .from(schema.collectionSubmissions)
    .innerJoin(
      schema.collectionContributors,
      eq(schema.collectionSubmissions.contributorId, schema.collectionContributors.id)
    )
    .where(and(
      eq(schema.collectionSubmissions.linkId, link.id),
      eq(schema.collectionSubmissions.review, 'approved')
    ))

  const present = albumImageKeys(album)
  const missing = approved.filter(row => row.albumKey && !present.has(row.albumKey))
  const batch = missing.slice(0, MAX_PER_RUN)
  if (!batch.length) return { ok: true, restored: 0, remaining: 0 }

  const copiedKeys: string[] = []
  try {
    for (const row of batch) {
      // The copy usually still exists — only the album row was removed. Copy
      // again only when the object itself is gone.
      const head = await blob.head(row.albumKey!).catch(() => null)
      if (!head) {
        await copyR2Object(row.r2Key, row.albumKey!)
        copiedKeys.push(row.albumKey!)
      }
    }
  } catch (error) {
    for (const key of copiedKeys) await blob.delete(key).catch(() => {})
    throw error
  }

  const fresh = await albumStore.get(album.id) ?? album
  const freshKeys = albumImageKeys(fresh)
  const newRows = batch
    .filter(row => !freshKeys.has(row.albumKey!))
    .map(row => albumRowFor(row.albumKey!, row.caption, creditFor(row)))

  await albumStore.update(album.id, {
    ...fresh,
    coverSrc: fresh.coverSrc || `/images/${batch[0]!.albumKey}`,
    rows: [...fresh.rows, ...newRows]
  }, { createIfMissing: true })

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'collection_link',
    entityId: link.id,
    entityTitle: `Re-added ${newRows.length} photo(s) to ${album.title || album.slug}`,
    metadata: { restored: newRows.length, albumId: album.id }
  })

  return { ok: true, restored: newRows.length, remaining: missing.length - batch.length }
})
