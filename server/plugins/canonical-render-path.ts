import { encodePath } from 'ufo'

// Nitro's swr/cache route-rule wrapper (routeRules in nuxt.config.ts) hands the
// renderer an event whose path is still percent-encoded: h3's app dispatcher
// decodes `event._path` for normal requests, but the cache wrapper builds a
// fresh inner event straight from the raw `req.url`. Nuxt's createSSRContext()
// then runs encodePath() over it, so every cached SSR of a non-ASCII URL (Thai
// album slugs) gains an encoding layer (% -> %25). That doubled URL is baked
// into the cached HTML as payload.path, the payload data-src and canonical
// links; on hydration the client router.replace()s to it, and every refresh
// stacks another layer until lookups 404. Rewrite the miscoded path back to
// its canonical single-encoded form before the HTML is sent (and cached).
function fullyDecodedPath(value: string): string {
  let current = value
  for (let i = 0; i < 5; i++) {
    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      break
    }
    if (decoded === current) break
    // A decode layer that introduces path-structure characters would change
    // the URL's meaning (e.g. %2F -> "/", %3F -> "?") — keep the previous form.
    if (decoded.includes('?') || decoded.includes('#') || decoded.split('/').length !== current.split('/').length) break
    current = decoded
  }
  return current
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const path = event.path
    const queryIndex = path.indexOf('?')
    const pathPart = queryIndex === -1 ? path : path.slice(0, queryIndex)
    if (!pathPart.includes('%')) return

    // `miscoded` reproduces what createSSRContext emitted for this event;
    // `canonical` is what an uncached (dispatcher-decoded) render would emit.
    const miscoded = encodePath(pathPart)
    const canonical = encodePath(fullyDecodedPath(pathPart))
    if (import.meta.dev) event.node.res.setHeader('x-canonical-render', `${pathPart} | ${miscoded} -> ${canonical}`)
    if (miscoded === canonical) return

    // The NUXT_DATA payload JSON escapes each slash as a backslash-u002F
    // sequence (devalue XSS escaping), so payload.path only matches in that
    // escaped spelling.
    const escapeSlashes = (value: string) => value.replaceAll('/', '\\u002F')
    const replacements: [string, string][] = [
      [miscoded, canonical],
      [escapeSlashes(miscoded), escapeSlashes(canonical)]
    ]

    for (const section of ['head', 'bodyPrepend', 'body', 'bodyAppend'] as const) {
      const chunks = html[section]
      if (!chunks) continue
      for (let i = 0; i < chunks.length; i++) {
        for (const [from, to] of replacements) {
          if (chunks[i]!.includes(from)) chunks[i] = chunks[i]!.replaceAll(from, to)
        }
      }
    }
  })
})
