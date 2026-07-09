import { z } from 'zod'

const bodySchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(250),
  force: z.boolean().optional()
})

// Batch "move to trash". Unlike permanent deletion (delete-session), trashing
// touches no R2 objects — it only scrubs live references (when forced) and
// records rows — so it runs entirely server-side in one request with no
// presigned URLs or completion round-trip.
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid trash payload.' })

  const keys = [...new Set(result.data.keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  if (!keys.length) throw createError({ statusCode: 400, message: 'No valid image keys provided.' })

  const references = await getR2DeleteReferences(keys)
  const force = !!result.data.force

  const evaluated = keys.map((key) => {
    const info = references.get(key) ?? emptyR2DeleteReferenceInfo()
    const referenced = isR2DeleteReferenced(info)
    const status: 'trashed' | 'blocked' = referenced && !force ? 'blocked' : 'trashed'
    return { key, status, referenced, info }
  })

  const toTrash = evaluated.filter(item => item.status === 'trashed')

  const referencedToScrub = toTrash.filter(item => item.referenced).map(item => item.key)
  if (referencedToScrub.length) await scrubR2DeleteReferences(referencedToScrub)

  await addToR2Trash(toTrash.map(item => ({
    key: item.key,
    referenced: item.referenced,
    references: item.info as unknown as Record<string, boolean>,
    deletedBy: actor.id,
    deletedByEmail: actor.email,
    deletedByName: actor.name ?? null
  })))

  const trashed = toTrash.length
  const blocked = evaluated.length - trashed

  if (trashed) {
    await recordAdminAudit(actor, {
      action: 'trash',
      entityType: 'media',
      entityId: `batch:${trashed}`,
      entityTitle: `${trashed} R2 image${trashed === 1 ? '' : 's'}`,
      metadata: {
        force,
        trashed,
        blocked,
        keys: toTrash.map(item => item.key).slice(0, 100),
        omittedKeys: Math.max(0, trashed - 100)
      }
    })
  }

  return {
    force,
    trashed,
    blocked,
    items: evaluated.map(item => ({ key: item.key, status: item.status, referenced: item.referenced }))
  }
})
