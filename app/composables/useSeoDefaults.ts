// Absolute URLs for og:image and JSON-LD must not be built from
// useRequestURL().origin. Every public page is swr-cached (routeRules in
// nuxt.config.ts) and Nitro's cache wrapper re-renders them on an inner event
// that carries no Host header, so the origin resolves to "http://localhost" and
// that dead URL gets baked into the cached HTML every scraper then reads. The
// configured site URL is the only origin that survives a cached render.
export function useSiteOrigin(): string {
  const configured = String(useRuntimeConfig().public.siteUrl || '').replace(/\/+$/, '')
  return configured || useRequestURL().origin
}

// Content without an excerpt used to fall back to its own title, which gave
// link previews a grey description identical to the blue heading above it.
// The club blurb says something instead.
export function useSeoFallbackDescription() {
  const { t } = useI18n()
  return computed(() => t('home.metaDescription'))
}
