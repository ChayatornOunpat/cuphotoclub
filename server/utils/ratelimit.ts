import type { H3Event } from 'h3'

export function clientIp(event: H3Event): string {
  return getRequestIP(event, { xForwardedFor: true }) || 'unknown'
}

// Best-effort fixed-window rate limit backed by KV. Returns true if allowed.
//
// Fails OPEN by default so a KV hiccup never blocks the site. Pass
// `failClosed` where the limit is the only thing standing between an attacker
// and an unbounded guess loop — a brute-force guard that evaporates the moment
// KV blips is not a guard.
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  options?: { failClosed?: boolean }
): Promise<boolean> {
  const now = Date.now()
  const ttl = Math.ceil(windowMs / 1000)
  try {
    const rl = await kv.get<{ count: number, resetAt: number }>(key)
    if (rl && now < rl.resetAt) {
      if (rl.count >= max) return false
      await kv.set(key, { count: rl.count + 1, resetAt: rl.resetAt }, { ttl })
    } else {
      await kv.set(key, { count: 1, resetAt: now + windowMs }, { ttl })
    }
  } catch {
    // KV unavailable → don't block, unless the caller says this limit matters
    // more than availability.
    if (options?.failClosed) return false
  }
  return true
}
