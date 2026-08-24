import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  // Filter by collection link — the only grouping a submission has.
  linkId: z.string().min(1).optional(),
  // 'unused' is the triage filter that replaces what a pending queue would have
  // been: show me what I have not done anything with yet.
  used: z.enum(['all', 'unused', 'used']).default('all'),
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
  const { linkId, used, page, perPage } = parsed.data

  const filters = [
    ...(linkId ? [eq(schema.collectionSubmissions.linkId, linkId)] : []),
    ...(used === 'unused' ? [isNull(schema.collectionSubmissions.publishedTo)] : []),
    ...(used === 'used' ? [sql`${schema.collectionSubmissions.publishedTo} is not null`] : [])
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
      publishedTo: schema.collectionSubmissions.publishedTo,
      publishedAt: schema.collectionSubmissions.publishedAt,
      createdAt: schema.collectionSubmissions.createdAt,
      // Credit lives on the contributor, so one person renaming themselves
      // re-credits their whole batch.
      contributorId: schema.collectionContributors.id,
      displayName: schema.collectionContributors.displayName,
      contact: schema.collectionContributors.contact
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

  return {
    total,
    page,
    perPage,
    pageCount: Math.max(1, Math.ceil(total / perPage)),
    items: rows.map(row => ({
      ...row,
      // Never an /images/ URL — that prefix is 404'd until a photo is published.
      previewUrl: `/api/admin/submissions/${row.id}/preview`,
      downloadUrl: `/api/admin/submissions/${row.id}/download?confirm=1`
    }))
  }
})
