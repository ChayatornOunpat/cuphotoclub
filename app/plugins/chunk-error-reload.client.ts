// After a new deploy, a browser tab left open (or one serving a stale cached
// HTML shell) can still reference JS chunk hashes that no longer exist on the
// server, causing "Failed to fetch dynamically imported module" errors.
// `vite:preloadError` fires for exactly this case — force a hard reload so
// the visitor transparently picks up the current build instead of seeing a
// dead page. Session-guarded so a genuinely broken chunk can't reload-loop.
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const key = 'cu-photo-chunk-reload'

  // A load that gets this far succeeded, so a future stale-chunk error
  // is a new incident, not the one we just reloaded for.
  nuxtApp.hook('app:mounted', () => sessionStorage.removeItem(key))

  window.addEventListener('vite:preloadError', () => {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
    window.location.reload()
  })
})
