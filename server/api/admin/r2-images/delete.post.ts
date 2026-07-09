export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const body = await readBody<{ key?: string; force?: boolean }>(event)
  const key = normalizeR2Key(body?.key)
  if (!key) throw createError({ statusCode: 400, message: 'Missing image key' })

  const references = await getR2DeleteReferences([key])
  const info = references.get(key) ?? emptyR2DeleteReferenceInfo()
  const inUse = isR2DeleteReferenced(info)
  if (inUse && !body?.force) {
    throw createError({
      statusCode: 409,
      message: 'This image is still referenced elsewhere. Remove it from its usage first, or move it to trash with force.'
    })
  }

  // Capture object metadata before we scrub anything, so the trash view can show
  // size/type without another round-trip. head() is best-effort.
  let contentType: string | null = null
  let size: number | null = null
  try {
    const head = await blob.head(key)
    contentType = head?.contentType ?? null
    size = typeof head?.size === 'number' ? head.size : null
  } catch {
    // ignore — metadata is optional
  }

  // Force-trashing an in-use image scrubs its live references so it leaves the
  // site's active surfaces immediately (no broken covers/hero slots/tiles). The
  // R2 object itself is kept in place — trash holds it until the admin restores
  // it or deletes it permanently.
  if (inUse && body?.force) {
    await scrubR2DeleteReferences([key])
  }

  await addToR2Trash([{
    key,
    contentType,
    size,
    referenced: inUse,
    references: info as unknown as Record<string, boolean>,
    deletedBy: actor.id,
    deletedByEmail: actor.email,
    deletedByName: actor.name ?? null
  }])

  await recordAdminAudit(actor, {
    action: 'trash',
    entityType: 'media',
    entityId: key,
    entityTitle: key.split('/').at(-1) ?? key,
    metadata: {
      forced: !!body?.force,
      inUse
    }
  })
  return { ok: true, trashed: true }
})
