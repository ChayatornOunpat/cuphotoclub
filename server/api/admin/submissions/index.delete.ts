import { inArray } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  // Bounded by subrequests, not by D1's 100-param cap: each orphaned key costs
  // a blob.head plus trash bookkeeping, and the free plan allows 50 subrequests
  // per request. Running out mid-loop is what strands objects.
  ids: z.array(z.string().min(1)).min(1).max(25)
})

// Remove photos from the pool. This is what a reject button would have been —
// there is no review status, so deleting the row *is* how junk leaves.
//
// Routed through the restorable trash rather than blob.delete(), and only once
// nothing else points at the object: content-addressed keys mean two people who
// sent the same photo share one, and there may be an album pointing at it too.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid payload.' })

  const removed = await db
    .delete(schema.collectionSubmissions)
    .where(inArray(schema.collectionSubmissions.id, result.data.ids))
    .returning({ id: schema.collectionSubmissions.id, r2Key: schema.collectionSubmissions.r2Key })

  if (!removed.length) return { ok: true, removed: 0, trashed: 0 }

  const keys = [...new Set(removed.map(row => row.r2Key))]
  // Recomputed after the rows are gone, so the deleted submissions do not count
  // as a reason to keep their own objects alive.
  const references = await getR2DeleteReferences(keys)
  const orphaned = keys.filter((key) => {
    const info = references.get(key)
    return !info || !isR2DeleteReferenced(info)
  })

  if (orphaned.length) {
    const entries = await Promise.all(orphaned.map(async (key) => {
      const head = await blob.head(key).catch(() => null)
      return {
        key,
        contentType: head?.contentType ?? null,
        size: head?.size ?? null,
        referenced: false,
        deletedBy: actor.id,
        deletedByEmail: actor.email,
        deletedByName: actor.name ?? null
      }
    }))
    await addToR2Trash(entries)
  }

  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'collection_submission',
    entityId: removed.map(row => row.id).join(','),
    entityTitle: `${removed.length} submission(s)`,
    metadata: { removed: removed.length, trashed: orphaned.length }
  })

  return { ok: true, removed: removed.length, trashed: orphaned.length }
})
