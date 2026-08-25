import { and, desc, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  // Filter by collection link — the only grouping a submission has.
  linkId: z.string().min(1).optional(),
  // The review decision. 'pending' is the default working set — what is left
  // to look at — so the pool feels like it empties.
  review: z.enum(['all', 'pending', 'approved', 'rejected']).default('all'),
  page: z.coerce.number().int().min(1).default(1),
  // Every thumbnail is an uncached Worker request serving a full-size original
  // (there is no resize: /cdn-cgi/image transforms are off for this volume), so
  // a page is real bandwidth. Keep it small.
  perPage: z.coerce.number().int().min(1).max(48).default(24)
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid query.' })
  const { linkId, review, page, perPage } = parsed.data

  const filters = [
    ...(linkId ? [eq(schema.collectionSubmissions.linkId, linkId)] : []),
    ...(review !== 'all' ? [eq(schema.collectionSubmissions.review, review)] : [])
  ]
  const where = filters.length ? and(...filters) : undefined

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.collectionSubmissions)
    .where(where)
  const total = Number(countRow?.total ?? 0)

  const rows = await db
    .select({
      id: schema.collectionSubmissions.id,
      linkId: schema.collectionSubmissions.linkId,
      linkLabel: schema.collectionLinks.label,
      caption: schema.collectionSubmissions.caption,
      r2Key: schema.collectionSubmissions.r2Key,
      size: schema.collectionSubmissions.size,
      type: schema.collectionSubmissions.type,
      review: schema.collectionSubmissions.review,
      albumKey: schema.collectionSubmissions.albumKey,
      publishedTo: schema.collectionSubmissions.publishedTo,
      publishedAt: schema.collectionSubmissions.publishedAt,
      createdAt: schema.collectionSubmissions.createdAt,
      // Credit lives on the contributor, so one person renaming themselves
      // re-credits their whole batch.
      contributorId: schema.collectionContributors.id,
      displayName: schema.collectionContributors.displayName,
      contact: schema.collectionContributors.contact,
      creditHandle: schema.collectionContributors.creditHandle,
      note: schema.collectionContributors.note
    })
    .from(schema.collectionSubmissions)
    .innerJoin(
      schema.collectionContributors,
      eq(schema.collectionSubmissions.contributorId, schema.collectionContributors.id)
    )
    .innerJoin(
      schema.collectionLinks,
      eq(schema.collectionSubmissions.linkId, schema.collectionLinks.id)
    )
    .where(where)
    .orderBy(desc(schema.collectionSubmissions.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage)

  // Tab counts for the whole collection, not the current page — one grouped
  // query rather than three filtered ones.
  const tallies = linkId
    ? await db
        .select({ review: schema.collectionSubmissions.review, n: sql<number>`count(*)` })
        .from(schema.collectionSubmissions)
        .where(eq(schema.collectionSubmissions.linkId, linkId))
        .groupBy(schema.collectionSubmissions.review)
    : []
  const counts = { pending: 0, approved: 0, rejected: 0, all: 0 }
  for (const row of tallies) {
    counts[row.review as 'pending' | 'approved' | 'rejected'] = Number(row.n)
    counts.all += Number(row.n)
  }

  // The album this collection feeds, and which approved photos it still shows.
  // Membership is derived rather than trusted — see server/utils/collectionAlbum.
  let album: { id: string, slug: string, title: string, visibility: string, coverSrc: string, photoCount: number } | null = null
  let missingFromAlbum = 0
  let presentKeys = new Set<string>()

  if (linkId) {
    const [link] = await db
      .select({ albumId: schema.collectionLinks.albumId })
      .from(schema.collectionLinks)
      .where(eq(schema.collectionLinks.id, linkId))
      .limit(1)
    const found = await linkedAlbum(link?.albumId ?? null)
    if (found) {
      presentKeys = albumImageKeys(found)
      album = {
        id: found.id,
        slug: found.slug,
        title: found.title,
        visibility: found.visibility,
        coverSrc: found.coverSrc,
        photoCount: presentKeys.size
      }
      const approvedKeys = await db
        .select({ albumKey: schema.collectionSubmissions.albumKey })
        .from(schema.collectionSubmissions)
        .where(and(
          eq(schema.collectionSubmissions.linkId, linkId),
          eq(schema.collectionSubmissions.review, 'approved')
        ))
      missingFromAlbum = approvedKeys.filter(row => !isInAlbum(row.albumKey, presentKeys)).length
    }
  }

  return {
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    counts,
    album,
    missingFromAlbum,
    items: rows.map(row => ({
      ...row,
      // Approved but no longer on the canvas: the decision stands, the album
      // disagrees. Shown as its own state rather than silently as 'approved'.
      inAlbum: row.review === 'approved' ? isInAlbum(row.albumKey, presentKeys) : false,
      // Never an /images/ URL — that prefix is 404'd until a photo is published.
      previewUrl: `/api/admin/submissions/${row.id}/preview`,
      downloadUrl: `/api/admin/submissions/${row.id}/download?confirm=1`
    }))
  }
})
