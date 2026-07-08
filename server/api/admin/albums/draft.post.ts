// Album-first: create an empty draft up front so images upload straight into
// content-albums/<id>/ (their permanent home) — no post-save object migration.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const album = await albumStore.createDraft()
  return {
    id: album.id,
    slug: album.slug,
    mediaPrefix: `content-albums/${album.id}`
  }
})
