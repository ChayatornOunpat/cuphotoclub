import { z } from 'zod'

const bodySchema = z.object({
  results: z.array(z.object({
    key: z.string().min(1),
    status: z.enum(['deleted', 'failed']),
    error: z.string().optional()
  })).min(1).max(250)
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const session = await getR2DeleteSession(id)
  if (!session) throw createError({ statusCode: 404, message: 'Delete session not found.' })
  if (session.actorId !== actor.id) {
    throw createError({ statusCode: 403, message: 'This delete session belongs to another admin.' })
  }

  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid delete completion payload.' })

  const itemsByKey = new Map(session.items.map(item => [item.key, item]))
  const accepted = result.data.results
    .map(item => ({ ...item, key: normalizeR2Key(item.key) }))
    .filter((item): item is { key: string; status: 'deleted' | 'failed'; error?: string } => !!item.key && itemsByKey.has(item.key))

  const updatedItems = [] as typeof session.items
  for (const resultItem of accepted) {
    const item = itemsByKey.get(resultItem.key)
    if (!item || item.status === 'blocked') continue
    item.status = resultItem.status
    item.error = resultItem.status === 'failed' ? resultItem.error || 'Direct R2 delete failed.' : undefined
    updatedItems.push(item)
  }

  if (updatedItems.length) await saveR2DeleteSessionItems(session, updatedItems)

  const deleted = session.items.filter(item => item.status === 'deleted')
  const failed = session.items.filter(item => item.status === 'failed')
  const blocked = session.items.filter(item => item.status === 'blocked')

  if (deleted.length) {
    await recordAdminAudit(actor, {
      action: 'delete',
      entityType: 'media',
      entityId: session.id,
      entityTitle: `${deleted.length} R2 image${deleted.length === 1 ? '' : 's'}`,
      metadata: {
        direct: true,
        force: session.force,
        deleted: deleted.length,
        failed: failed.length,
        blocked: blocked.length,
        keys: deleted.map(item => item.key).slice(0, 100),
        omittedKeys: Math.max(0, deleted.length - 100)
      }
    })
  }

  return r2DeleteSessionSummary(session)
})
