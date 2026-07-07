import { z } from 'zod'

const bodySchema = z.object({
  keys: z.array(z.string().min(1)).min(1).max(250),
  force: z.boolean().optional()
})

export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const result = await readValidatedBody(event, bodySchema.safeParse)
  if (!result.success) throw createError({ statusCode: 400, message: 'Invalid delete session payload.' })

  const keys = [...new Set(result.data.keys.map(key => normalizeR2Key(key)).filter((key): key is string => !!key))]
  if (!keys.length) throw createError({ statusCode: 400, message: 'No valid image keys provided.' })

  const references = await getR2DeleteReferences(keys)
  const force = !!result.data.force
  const directConfig = assertR2DirectUploadConfig()

  if (force) {
    const referencedKeys = keys.filter(key => isR2DeleteReferenced(references.get(key) ?? emptyR2DeleteReferenceInfo()))
    if (referencedKeys.length) await scrubR2DeleteReferences(referencedKeys)
  }

  const signedDeletes = await mapUploadSessionItems(keys, 16, async (key) => {
    const referenced = isR2DeleteReferenced(references.get(key) ?? emptyR2DeleteReferenceInfo())
    if (referenced && !force) {
      return {
        key,
        status: 'blocked' as const,
        referenced,
        error: 'This image is still referenced elsewhere.'
      }
    }

    return {
      key,
      status: 'ready' as const,
      referenced,
      delete: await createR2PresignedDeleteUrl({
        ...directConfig,
        key,
        expiresSeconds: 900
      })
    }
  })

  const now = new Date().toISOString()
  const session: R2DeleteSession = {
    id: crypto.randomUUID(),
    actorId: actor.id,
    force,
    createdAt: now,
    updatedAt: now,
    items: signedDeletes.map(item => ({
      key: item.key,
      status: item.status,
      referenced: item.referenced,
      error: 'error' in item ? item.error : undefined
    }))
  }
  await saveR2DeleteSession(session)

  return {
    ...r2DeleteSessionSummary(session),
    items: signedDeletes
  }
})
