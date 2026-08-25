import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

// Each approval is one blob.head + one copy, plus D1. The client sends these
// one at a time (see the pool page's serialised queue) so this stays far inside
// the 50-subrequest budget; the cap is a guard against a hand-rolled call, not
// the shape the UI uses.
const MAX_IDS = 12

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_IDS),
  decision: z.enum(['approved', 'rejected', 'pending'])
})

// Record a review decision, and make the album match it.
//
//   approved → copy the object into the album and append a row
//   rejected → no album work; the row stays so the call is reversible
//   pending  → undo: drop every cell showing that copy, delete the copy
//
// The album write is a read-modify-write of one JSON rows array, which is why
// the client serialises calls rather than firing a burst.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid payload.' })
  const { ids, decision } = result.data

  const rows = await db
    .select({
      id: schema.collectionSubmissions.id,
      linkId: schema.collectionSubmissions.linkId,
      r2Key: schema.collectionSubmissions.r2Key,
      hash: schema.collectionSubmissions.hash,
      type: schema.collectionSubmissions.type,
      caption: schema.collectionSubmissions.caption,
      albumKey: schema.collectionSubmissions.albumKey,
      review: schema.collectionSubmissions.review,
      displayName: schema.collectionContributors.displayName,
      contact: schema.collectionContributors.contact,
      creditHandle: schema.collectionContributors.creditHandle
    })
    .from(schema.collectionSubmissions)
    .innerJoin(
      schema.collectionContributors,
      eq(schema.collectionSubmissions.contributorId, schema.collectionContributors.id)
    )
    .where(inArray(schema.collectionSubmissions.id, ids))

  if (!rows.length) throw createError({ statusCode: 404, message: 'No matching submissions.' })

  // One collection per call: the album write below targets a single album.
  const linkId = rows[0]!.linkId
  if (rows.some(row => row.linkId !== linkId)) {
    throw createError({ statusCode: 400, message: 'Submissions must belong to one collection.' })
  }

  const [link] = await db
    .select()
    .from(schema.collectionLinks)
    .where(eq(schema.collectionLinks.id, linkId))
    .limit(1)
  if (!link) throw createError({ statusCode: 404, message: 'ไม่พบลิงก์รวมรูป' })

  const now = new Date()

  // ── Rejecting touches nothing in R2 ──────────────────────────────────────
  if (decision === 'rejected') {
    await db
      .update(schema.collectionSubmissions)
      .set({ review: 'rejected', reviewedAt: now, reviewedBy: actor.id })
      .where(inArray(schema.collectionSubmissions.id, rows.map(r => r.id)))

    await recordAdminAudit(actor, {
      action: 'update',
      entityType: 'collection_submission',
      entityId: rows.map(r => r.id).join(','),
      entityTitle: `${rows.length} rejected`,
      metadata: { decision, count: rows.length }
    })
    return { ok: true, decision, count: rows.length }
  }

  // ── Undo: pull the copies back out of the album ──────────────────────────
  if (decision === 'pending') {
    const album = await linkedAlbum(link.albumId)
    const keys = rows.map(r => r.albumKey).filter((k): k is string => !!k)

    if (album && keys.length) {
      const drop = new Set(keys)
      // Match by src wherever it sits, never by position — the canvas may have
      // reordered, re-spanned or re-grouped everything since the approval.
      const kept = album.rows
        .map(row => ({ ...row, cells: row.cells.filter(cell => !(cell.type === 'image' && drop.has(String(cell.src).replace(/^\/images\//, '')))) }))
        .filter(row => row.cells.length)
      const cover = drop.has(album.coverSrc.replace(/^\/images\//, '')) ? '' : album.coverSrc
      await albumStore.update(album.id, { ...album, rows: kept, coverSrc: cover })
    }
    // After the album no longer points at them, so a failed album write never
    // leaves a row claiming a copy that is already gone.
    for (const key of keys) await blob.delete(key).catch(() => {})

    await db
      .update(schema.collectionSubmissions)
      .set({ review: 'pending', reviewedAt: null, reviewedBy: null, albumKey: null, publishedTo: null, publishedAt: null })
      .where(inArray(schema.collectionSubmissions.id, rows.map(r => r.id)))

    await recordAdminAudit(actor, {
      action: 'update',
      entityType: 'collection_submission',
      entityId: rows.map(r => r.id).join(','),
      entityTitle: `${rows.length} returned to review`,
      metadata: { decision, count: rows.length }
    })
    return { ok: true, decision, count: rows.length }
  }

  // ── Approve: copy in, then record ────────────────────────────────────────
  const album = await ensureCollectionAlbum(link)
  const present = albumImageKeys(album)
  const copiedKeys: string[] = []
  const added: Array<{ id: string, key: string, caption: string | null, credit: string | null }> = []

  try {
    for (const row of rows) {
      const key = row.albumKey || albumKeyFor(album.id, row.hash, row.type)
      const credit = creditFor(row)

      // Content-addressed, so a re-approval of the same photo finds its own
      // copy already there. Only the album row needs adding back.
      if (!present.has(key)) {
        const head = await blob.head(key).catch(() => null)
        if (!head) {
          await copyR2Object(row.r2Key, key)
          copiedKeys.push(key)
        }
        added.push({ id: row.id, key, caption: row.caption, credit })
      }
      row.albumKey = key
    }
  } catch (error) {
    // Objects this run created would otherwise sit in the album's folder with
    // nothing pointing at them.
    for (const key of copiedKeys) await blob.delete(key).catch(() => {})
    throw error
  }

  if (added.length) {
    // Re-read immediately before writing to narrow the read-modify-write window
    // against a canvas save landing at the same moment.
    const fresh = await albumStore.get(album.id) ?? album
    const freshKeys = albumImageKeys(fresh)
    const newRows = added
      .filter(item => !freshKeys.has(item.key))
      .map(item => albumRowFor(item.key, item.caption, item.credit))
    await albumStore.update(album.id, {
      ...fresh,
      coverSrc: fresh.coverSrc || `/images/${added[0]!.key}`,
      rows: [...fresh.rows, ...newRows]
    }, { createIfMissing: true })
  }

  for (const row of rows) {
    await db
      .update(schema.collectionSubmissions)
      .set({
        review: 'approved',
        reviewedAt: now,
        reviewedBy: actor.id,
        albumKey: row.albumKey,
        publishedTo: `album:${album.id}`,
        publishedAt: now
      })
      .where(eq(schema.collectionSubmissions.id, row.id))
  }

  await recordAdminAudit(actor, {
    action: 'update',
    entityType: 'collection_submission',
    entityId: rows.map(r => r.id).join(','),
    entityTitle: `${rows.length} approved into ${album.title || album.slug}`,
    metadata: { decision, count: rows.length, albumId: album.id }
  })

  return {
    ok: true,
    decision,
    count: rows.length,
    album: { id: album.id, slug: album.slug, title: album.title }
  }
})
