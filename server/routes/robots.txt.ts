// Dynamic robots.txt: the Sitemap directive must be an absolute URL (the
// protocol ignores relative paths), so we resolve it from the configured
// siteUrl (falling back to the request origin). Also keeps crawlers out of the
// admin area, the API, and internal scratch/bench pages.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const base = (config.public.siteUrl || getRequestURL(event).origin).replace(/\/+$/, '')

  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /search
Disallow: /font-bench
Disallow: /intro-bench
Disallow: /photogrid-bench

Sitemap: ${base}/sitemap.xml
`

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return body
})
