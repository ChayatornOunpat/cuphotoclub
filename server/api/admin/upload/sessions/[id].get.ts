export default defineEventHandler(async (event) => {
  const actor = await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''
  const session = await getUploadSession(id)

  if (!session) {
    throw createError({ statusCode: 404, message: 'Upload session not found.' })
  }
  if (session.actorId !== actor.id) {
    throw createError({ statusCode: 403, message: 'This upload session belongs to another admin.' })
  }

  return uploadSessionSummary(session)
})
