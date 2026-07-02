import type { AlbumInput } from '~~/shared/types'

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const body = await readBody<AlbumInput>(event)
  body.placement = 'gallery'

  const error = validateAlbum(body)
  if (error) throw createError({ statusCode: 400, statusMessage: error })

  if (!body.published) body.published = new Date().toISOString().slice(0, 10)
  body.visibility ??= 'draft'

  return await albumStore.create(body)
})
