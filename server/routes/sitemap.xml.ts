import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const base = getRequestURL(event).origin

  const [albums, posts, events] = await Promise.all([
    db.select({ slug: schema.albums.slug }).from(schema.albums).where(eq(schema.albums.status, 'published')),
    db.select({ slug: schema.posts.slug }).from(schema.posts).where(eq(schema.posts.status, 'published')),
    db.select({ slug: schema.events.slug }).from(schema.events).where(eq(schema.events.status, 'published'))
  ])

  const paths = [
    '',
    '/galleries',
    '/blog',
    '/activities',
    '/about',
    '/contact',
    ...albums.map(a => `/galleries/${a.slug}`),
    ...posts.map(p => `/blog/${p.slug}`),
    ...events.map(e => `/activities/${e.slug}`)
  ]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map(p => `  <url><loc>${base}${p}</loc></url>`).join('\n')}
</urlset>`

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return xml
})
