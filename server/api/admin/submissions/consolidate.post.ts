import type { Album, AlbumRow } from '~~/shared/types'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

// Each item costs up to two R2 round trips (head + copy) on top of the D1
// reads and writes. The free plan allows 50 subrequests per request, and
// running out mid-loop is what used to strand half-copied objects.
const MAX_PER_RUN = 15

const bodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(MAX_PER_RUN),
  // Omit to start a fresh draft album for these photos.
  albumId: z.string().min(1).optional(),
  title: z.string().trim().max(200).optional()
})

// Turn pool photos into a content album — the end state for a good event.
//
// Publishing COPIES the object into content-albums/<albumId>/ rather than
// referencing it where it lies. That is what buys three things at once:
//   1. /images/ can hard-404 the whole contributions/ prefix, because nothing
//      published ever lives there — a real gate, not "we don't share the URL".
//   2. A contributor withdrawing later cannot punch a hole in a published album,
//      which is why their permission model collapses to "the link is the window".
//   3. It matches the album-first invariant the rest of the codebase assumes.
//
// Batched (see MAX_PER_RUN) because each item is an R2 round trip; larger jobs
// run as several batches rather than one long Worker request.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid payload.' })
  const { ids, albumId, title } = result.data

  const rows = await db
    .select({
      id: schema.eventSubmissions.id,
      r2Key: schema.eventSubmissions.r2Key,
      caption: schema.eventSubmissions.caption,
      hash: schema.eventSubmissions.hash,
      displayName: schema.eventContributors.displayName
    })
    .from(schema.eventSubmissions)
    .innerJoin(
      schema.eventContributors,
      eq(schema.eventSubmissions.contributorId, schema.eventContributors.id)
    )
    .where(inArray(schema.eventSubmissions.id, ids))

  if (!rows.length) throw createError({ statusCode: 404, message: 'No matching submissions.' })

  // A new album has to exist before the copies, because its id *is* the R2
  // folder they are copied into.
  const createdHere = !albumId
  const album: Album | null = albumId
    ? await albumStore.get(albumId)
    : await albumStore.createDraft()
  if (!album) throw createError({ statusCode: 404, message: 'Album not found.' })

  // Whatever the album already shows. A retried request (timeout, double click)
  // must not append the same photo twice, so anything already present is marked
  // published and otherwise skipped.
  const alreadyInAlbum = new Set(
    album.rows
      .flatMap(row => row.cells)
      .filter(cell => cell.type === 'image' && cell.src)
      .map(cell => normalizeR2Key(cell.src) || '')
      .filter(Boolean)
  )

  // Copy first, mutate the album second: a failed copy should leave nothing
  // half-written rather than an album pointing at objects that never arrived.
  const copied: Array<{ id: string, key: string, caption: string | null, credit: string | null }> = []
  const alreadyPresent: string[] = []
  const copiedKeys: string[] = []
  try {
    for (const row of rows) {
      const ext = sanitizeUploadExt(row.r2Key.split('.').pop() || 'jpg')
      const destKey = `content-albums/${album.id}/${sanitizeUploadHash(row.hash) || crypto.randomUUID()}.${ext}`
      if (alreadyInAlbum.has(destKey)) {
        alreadyPresent.push(row.id)
        continue
      }
      // Content-addressed, so re-consolidating the same photo is a no-op rather
      // than a duplicate object.
      const existing = await blob.head(destKey).catch(() => null)
      if (!existing) {
        await copyR2Object(row.r2Key, destKey)
        copiedKeys.push(destKey)
      }
      alreadyInAlbum.add(destKey)
      copied.push({ id: row.id, key: destKey, caption: row.caption, credit: row.displayName })
    }
  } catch (error) {
    // Unwind: objects this run created would otherwise sit in the album's folder
    // referenced by nothing, and an empty untitled draft would be left behind on
    // every failed attempt until the album list filled with litter.
    for (const key of copiedKeys) await blob.delete(key).catch(() => {})
    if (createdHere) await albumStore.remove(album.id).catch(() => {})
    throw error
  }

  // One full-width image per row, matching how the album canvas lays out a
  // fresh import; the editor rearranges from there.
  const newRows: AlbumRow[] = copied.map(item => ({
    cells: [{
      type: 'image' as const,
      span: 6 as const,
      src: `/images/${item.key}`,
      // Credit the contributor by default. An editor can rewrite this on the
      // canvas, but the attribution should never be lost by omission.
      ...(item.caption || item.credit
        ? { caption: [item.caption, item.credit && `© ${item.credit}`].filter(Boolean).join(' · ') }
        : {})
    }]
  }))

  // Re-read immediately before writing so a concurrent consolidation into the
  // same album is far less likely to be clobbered by this read-modify-write.
  // It narrows the window rather than closing it — two admins consolidating
  // into one album at the same instant can still lose a set of rows.
  const fresh = await albumStore.get(album.id) ?? album
  const updated = await albumStore.update(album.id, {
    ...fresh,
    title: title || fresh.title,
    coverSrc: fresh.coverSrc || (copied[0] ? `/images/${copied[0].key}` : ''),
    rows: [...fresh.rows, ...newRows]
  }, { createIfMissing: true })

  const now = new Date()
  const published = [...copied.map(item => item.id), ...alreadyPresent]
  if (published.length) {
    await db
      .update(schema.eventSubmissions)
      .set({ publishedTo: `album:${album.id}`, publishedAt: now })
      .where(inArray(schema.eventSubmissions.id, published))
  }

  await recordAdminAudit(actor, {
    action: 'publish',
    entityType: 'event_submission',
    entityId: copied.map(item => item.id).join(','),
    entityTitle: `${copied.length} photo(s) → ${updated?.title || album.slug}`,
    metadata: { albumId: album.id, albumSlug: updated?.slug ?? album.slug, count: copied.length }
  })

  return {
    ok: true,
    count: copied.length,
    skipped: alreadyPresent.length,
    album: { id: album.id, slug: updated?.slug ?? album.slug, title: updated?.title ?? album.title }
  }
})
