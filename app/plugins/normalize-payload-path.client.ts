// Companion to server/plugins/canonical-render-path.ts. Old SWR cache entries
// (and any renderer path that slips through) can still serve HTML whose
// payload.path is percent-encoded once more than the URL in the address bar.
// Nuxt's router plugin does router.replace(payload.path) on app:created, so a
// mismatched payload.path triggers a real navigation to the re-encoded URL —
// each refresh then stacks another %25 layer. If payload.path is just a
// re-encoded spelling of the current location, pin it to the current location
// so that replace is a no-op. Also heal an already multi-encoded address bar
// back to its canonical form (cosmetic replaceState, no reload).
function fullyDecoded(value: string): string {
  let current = value
  for (let i = 0; i < 5; i++) {
    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      break
    }
    if (decoded === current) break
    current = decoded
  }
  return current
}

export default defineNuxtPlugin({
  name: 'normalize-payload-path',
  setup(nuxtApp) {
    // All plugins run before the app:created hook that consumes payload.path.
    const path = nuxtApp.payload.path
    const current = window.location.pathname + window.location.search + window.location.hash
    if (path && path !== current && path.includes('%') && fullyDecoded(path) === fullyDecoded(current)) {
      nuxtApp.payload.path = current
    }

    onNuxtReady(() => {
      const { pathname } = window.location
      // %25 in the path means an encoding got encoded — a poisoned URL from
      // before the fix. Collapse it so the address bar shows the real slug.
      if (!pathname.includes('%25')) return
      const decoded = fullyDecoded(pathname)
      if (decoded === pathname || decoded.includes('?') || decoded.includes('#') || decoded.split('/').length !== pathname.split('/').length) return
      history.replaceState(history.state, '', decoded + window.location.search + window.location.hash)
    })
  }
})
