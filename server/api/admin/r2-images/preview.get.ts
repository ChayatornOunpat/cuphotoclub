// Admin thumbnails for the R2 inventory.
//
// /images/ hard-404s the private prefix (participant uploads are never public),
// so the inventory page cannot render those rows through it. This is the admin
// side door: same objects, behind requireAdmin, and deliberately uncached —
// nothing under that prefix is public, so it must never reach a shared cache.
//
// Keyed by R2 key rather than submission id (unlike submissions/[id]/preview)
// because the inventory's job includes blobs with no database row at all — the
// orphans it exists to find.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const key = normalizeR2Key(String(getQuery(event).key || ''))
  if (!key) throw createError({ statusCode: 400, message: 'Missing image key.' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return blob.serve(event, key)
})
