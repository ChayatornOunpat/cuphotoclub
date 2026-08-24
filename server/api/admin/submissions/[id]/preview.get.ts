import { eq } from 'drizzle-orm'

// Pool thumbnails. The contributions/ prefix is 404'd on /images/, so this is
// the only way an admin sees an unpublished photo — and it is deliberately
// uncached, because nothing here is public yet.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id') || ''

  const [row] = await db
    .select({ r2Key: schema.eventSubmissions.r2Key })
    .from(schema.eventSubmissions)
    .where(eq(schema.eventSubmissions.id, id))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'Submission not found.' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return blob.serve(event, row.r2Key)
})
