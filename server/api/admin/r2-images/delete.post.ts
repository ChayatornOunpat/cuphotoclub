export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)

  const body = await readBody<{ key?: string; force?: boolean }>(event)
  const key = normalizeR2Key(body?.key)
  if (!key) throw createError({ statusCode: 400, message: 'Missing image key' })

  const references = await getR2DeleteReferences([key])
  const inUse = isR2DeleteReferenced(references.get(key) ?? emptyR2DeleteReferenceInfo())
  if (inUse && !body?.force) {
    throw createError({
      statusCode: 409,
      message: 'This image is still referenced elsewhere. Remove it from its usage first, or delete with force.'
    })
  }

  // Force-deleting an in-use image: scrub every reference so nothing points at a
  // blob that no longer exists (broken covers, hero slots, gallery tiles).
  if (inUse && body?.force) {
    await scrubR2DeleteReferences([key])
  }

  await blob.delete(key)
  await recordAdminAudit(actor, {
    action: 'delete',
    entityType: 'media',
    entityId: key,
    entityTitle: key.split('/').at(-1) ?? key,
    metadata: {
      forced: !!body?.force,
      inUse
    }
  })
  return { ok: true }
})
