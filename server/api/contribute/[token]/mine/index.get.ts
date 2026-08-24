import { desc, eq } from 'drizzle-orm'

// This contributor's own photos. Readable even on a closed link — a returning
// participant should see what they sent rather than an empty page; only the
// write routes require the link to be open.
//
// Never returns an /images/ URL: the contributions prefix is 404'd there. The
// page renders thumbnails through the uncached preview route instead.
export default defineEventHandler(async (event) => {
  const token = getRouterParam(event, 'token') || ''
  const link = await requireLink(token)
  const contributor = await currentContributor(event, link)
  if (!contributor) return { open: isLinkOpen(link), items: [] }

  const rows = await db
    .select({
      id: schema.collectionSubmissions.id,
      caption: schema.collectionSubmissions.caption,
      size: schema.collectionSubmissions.size,
      type: schema.collectionSubmissions.type,
      createdAt: schema.collectionSubmissions.createdAt,
      publishedTo: schema.collectionSubmissions.publishedTo
    })
    .from(schema.collectionSubmissions)
    .where(eq(schema.collectionSubmissions.contributorId, contributor.id))
    .orderBy(desc(schema.collectionSubmissions.createdAt))

  return {
    open: isLinkOpen(link),
    items: rows.map(row => ({
      ...row,
      previewUrl: `/api/contribute/${encodeURIComponent(token)}/preview/${row.id}`
    }))
  }
})
