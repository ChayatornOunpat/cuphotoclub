import { and, eq } from 'drizzle-orm'

// Thumbnails for the contributor's own grid.
//
// The contributions/ prefix is 404'd on /images/, so this is the only way a
// participant can see what they sent. Uncached by design: no route rule matches
// /api/**, and the header below keeps it out of any shared cache too.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireLink(token)
  const contributor = await requireContributor(event, link)
  const id = getRouterParam(event, 'id') || ''

  const [row] = await db
    .select({ r2Key: schema.collectionSubmissions.r2Key })
    .from(schema.collectionSubmissions)
    .where(and(
      eq(schema.collectionSubmissions.id, id),
      eq(schema.collectionSubmissions.contributorId, contributor.id)
    ))
    .limit(1)

  if (!row) throw createError({ statusCode: 404, message: 'ไม่พบรูปนี้' })

  setHeader(event, 'Cache-Control', 'private, no-store')
  return blob.serve(event, row.r2Key)
})
