import { z } from 'zod'

const querySchema = z.object({
  // When set, return up to `limit` posts related to this one (same tag first,
  // then most recent) instead of the full public list.
  relatedTo: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(20).default(3)
})

export default defineEventHandler(async (event) => {
  const parsed = querySchema.safeParse(getQuery(event))
  if (!parsed.success) throw createError({ statusCode: 400, message: 'Invalid query.' })
  const { relatedTo, limit } = parsed.data

  const publicPosts = (await postStore.list()).filter(post => post.visibility === 'public')

  if (!relatedTo) return publicPosts

  // Related selection: same tag first, otherwise most recent. The list is
  // already sorted newest-first, so group-stable ordering keeps recency.
  const others = publicPosts.filter(post => post.id !== relatedTo)
  const tag = publicPosts.find(post => post.id === relatedTo)?.tag
  if (!tag) return others.slice(0, limit)
  const sameTag = others.filter(post => post.tag === tag)
  const rest = others.filter(post => post.tag !== tag)
  return [...sameTag, ...rest].slice(0, limit)
})
