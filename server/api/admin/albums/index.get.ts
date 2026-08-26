import { z } from 'zod'

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  sort: z.enum(['newest', 'oldest', 'title', 'category', 'modified']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  // Omitted = every album, for the callers that fill a dropdown. The list page
  // always sends one.
  pageSize: z.coerce.number().int().min(1).max(200).optional()
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid query.' })
  const { q, sort, page, pageSize } = parsed.data

  // Search and sort run in SQL, not in the browser, so a page of results costs
  // one small query no matter how many albums exist. `rows` is never selected:
  // it is ~3MB across the table and this list only needs a cover + photo count,
  // both of which are stored as their own columns.
  const { items, total } = await albumStore.listMeta({
    q,
    sort,
    limit: pageSize,
    offset: pageSize ? (page - 1) * pageSize : undefined
  })

  // `total` counts matches; `totalAll` is the whole library, so the list header
  // can say "12 of 139". Only worth a second count when a search narrows it.
  return { items, total, totalAll: q ? await albumStore.count() : total }
})
