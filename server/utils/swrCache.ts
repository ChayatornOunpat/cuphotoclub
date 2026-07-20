// Nitro's swr route-rule cache (hub.cache, see nuxt.config.ts) is keyed by
// hashed internal names that aren't practical to reconstruct per-route, so
// admin mutations that need the public site to reflect a change immediately
// purge the whole CACHE KV namespace — the same blunt approach the deploy
// workflow already uses (.github/workflows/deploy.yml).
export async function purgeSwrCache() {
  const cache = useStorage('cache')
  const keys = await cache.getKeys()
  await Promise.all(keys.map(key => cache.removeItem(key)))
}
