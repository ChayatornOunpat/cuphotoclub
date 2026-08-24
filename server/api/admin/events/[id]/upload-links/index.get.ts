import { desc, eq, inArray, sql } from 'drizzle-orm'

// Collection links for one event, with how much has come in through each.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'รหัสไม่ถูกต้อง' })

  const links = await db
    .select()
    .from(schema.eventUploadLinks)
    .where(eq(schema.eventUploadLinks.eventId, id))
    .orderBy(desc(schema.eventUploadLinks.createdAt))

  // One grouped count for the whole event rather than a query per link.
  const counts = await db
    .select({
      linkId: schema.eventSubmissions.linkId,
      total: sql<number>`count(*)`
    })
    .from(schema.eventSubmissions)
    .where(eq(schema.eventSubmissions.eventId, id))
    .groupBy(schema.eventSubmissions.linkId)

  const byLink = new Map(counts.map(row => [row.linkId, Number(row.total)]))
  // Scoped to this event's links; without the filter this reads every
  // contributor row on the site to build a handful of counts.
  const linkIds = links.map(link => link.id)
  const contributors = linkIds.length
    ? await db
        .select({
          linkId: schema.eventContributors.linkId,
          total: sql<number>`count(*)`
        })
        .from(schema.eventContributors)
        .where(inArray(schema.eventContributors.linkId, linkIds.slice(0, 90)))
        .groupBy(schema.eventContributors.linkId)
    : []
  const peopleByLink = new Map(contributors.map(row => [row.linkId, Number(row.total)]))

  return links.map(link => ({
    ...link,
    open: isLinkOpen(link),
    photoCount: byLink.get(link.id) ?? 0,
    contributorCount: peopleByLink.get(link.id) ?? 0
  }))
})
