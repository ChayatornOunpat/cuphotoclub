import { desc, inArray, sql } from 'drizzle-orm'

// All collection links, newest first, with how much has come in through each.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const links = await db
    .select()
    .from(schema.collectionLinks)
    .orderBy(desc(schema.collectionLinks.createdAt))

  // One grouped count for all links rather than a query per link. D1 caps a
  // query at 100 bound parameters; a club will not run 90 concurrent
  // collections, so the slice is a guard, not a design assumption.
  const linkIds = links.map(link => link.id).slice(0, 90)
  const counts = linkIds.length
    ? await db
        .select({
          linkId: schema.collectionSubmissions.linkId,
          total: sql<number>`count(*)`
        })
        .from(schema.collectionSubmissions)
        .where(inArray(schema.collectionSubmissions.linkId, linkIds))
        .groupBy(schema.collectionSubmissions.linkId)
    : []
  const byLink = new Map(counts.map(row => [row.linkId, Number(row.total)]))

  const contributors = links.length
    ? await db
        .select({
          linkId: schema.collectionContributors.linkId,
          total: sql<number>`count(*)`
        })
        .from(schema.collectionContributors)
        .where(inArray(schema.collectionContributors.linkId, linkIds))
        .groupBy(schema.collectionContributors.linkId)
    : []
  const peopleByLink = new Map(contributors.map(row => [row.linkId, Number(row.total)]))

  return links.map(link => ({
    ...link,
    open: isLinkOpen(link),
    photoCount: byLink.get(link.id) ?? 0,
    contributorCount: peopleByLink.get(link.id) ?? 0
  }))
})
