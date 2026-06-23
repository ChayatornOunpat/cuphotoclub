import { eq } from 'drizzle-orm'

const DEFAULT_TITLES: Record<string, string> = { about: 'เกี่ยวกับเรา' }

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const key = getRouterParam(event, 'key') || ''

  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.key, key)).limit(1)
  return page ?? { key, title: DEFAULT_TITLES[key] || key, body: '' }
})
