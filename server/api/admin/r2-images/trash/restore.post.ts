import { z } from 'zod'

const bodySchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(250)
})

// Restore = drop the trash rows. The R2 object was never moved, so it simply
// reappears in the inventory (as unreferenced — former references were scrubbed
// at trash time and are not automatically reattached).
export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid restore payload.' })

  const keys = [...new Set(result.data.keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  if (!keys.length) throw createError({ statusCode: 400, message: 'No valid image keys provided.' })

  await removeFromR2Trash(keys)

  await recordAdminAudit(actor, {
    action: 'restore',
    entityType: 'media',
    entityId: `batch:${keys.length}`,
    entityTitle: `${keys.length} R2 image${keys.length === 1 ? '' : 's'}`,
    metadata: {
      restored: keys.length,
      keys: keys.slice(0, 100),
      omittedKeys: Math.max(0, keys.length - 100)
    }
  })

  return { ok: true, restored: keys.length }
})
