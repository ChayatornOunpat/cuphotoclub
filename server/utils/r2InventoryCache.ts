// Short-lived in-isolate cache for the admin R2 inventory payload. The
// inventory endpoint lists every R2 blob, cross-references six tables and
// parses every album layout — on the free Worker plan that brushes the
// resource limit and the page times out. Memoizing for a minute keeps
// auto-refresh and repeat visits instant.
//
// Auth is still enforced per request by the endpoint (requireAdmin runs
// before the cache is read); the payload is identical for every admin, so
// memoizing it leaks nothing between users.
const TTL_MS = 60_000
const cache = new Map<string, { at: number, payload: unknown }>()

export function getCachedR2Inventory<T>(key: string): T | null {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.payload as T
  cache.delete(key)
  return null
}

export function setCachedR2Inventory(key: string, payload: unknown) {
  cache.set(key, { at: Date.now(), payload })
}

// Called by every endpoint that mutates the inventory (trash, restore,
// permanent delete, upload completion) so the next load never shows stale state.
export function invalidateR2Inventory() {
  cache.clear()
}
