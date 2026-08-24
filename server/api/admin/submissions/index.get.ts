import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'

const querySchema = z.object({
  eventId: z.coerce.number().int().optional(),
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
  const { eventId, used, page, perPage } = parsed.data

  const filters = [
    ...(eventId ? [eq(schema.eventSubmissions.eventId, eventId)] : []),
    ...(used === 'unused' ? [isNull(schema.eventSubmissions.publishedTo)] : []),
    ...(used === 'used' ? [sql`${schema.eventSubmissions.publishedTo} is not null`] : [])
  ]
  const where = filters.length ? and(...filters) : undefined

  const [countRow] = await db
    .select({ total: sql<number>`count(*)` })
    .from(schema.eventSubmissions)
    .where(where)
  const total = Number(countRow?.total ?? 0)

  const rows = await db
    .select({
      id: schema.eventSubmissions.id,
      eventId: schema.eventSubmissions.eventId,
      linkId: schema.eventSubmissions.linkId,
      caption: schema.eventSubmissions.caption,
      r2Key: schema.eventSubmissions.r2Key,
      size: schema.eventSubmissions.size,
      type: schema.eventSubmissions.type,
      publishedTo: schema.eventSubmissions.publishedTo,
      publishedAt: schema.eventSubmissions.publishedAt,
      createdAt: schema.eventSubmissions.createdAt,
      // Credit lives on the contributor, so one person renaming themselves
      // re-credits their whole batch.
      contributorId: schema.eventContributors.id,
      displayName: schema.eventContributors.displayName,
      contact: schema.eventContributors.contact
    })
    .from(schema.eventSubmissions)
    .innerJoin(
      schema.eventContributors,
      eq(schema.eventSubmissions.contributorId, schema.eventContributors.id)
    )
    .where(where)
    .orderBy(desc(schema.eventSubmissions.createdAt))
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
