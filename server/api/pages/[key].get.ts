import { eq } from 'drizzle-orm'

const DEFAULT_TITLES: Record<string, string> = { about: 'เกี่ยวกับเรา' }

// Public: an editable page with rendered HTML.
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') || ''
  const [page] = await db.select().from(schema.pages).where(eq(schema.pages.key, key)).limit(1)

  if (!page) return { key, title: DEFAULT_TITLES[key] || key, bodyHtml: '' }
  return { key: page.key, title: page.title, bodyHtml: renderMarkdown(page.body), updatedAt: page.updatedAt }
})
