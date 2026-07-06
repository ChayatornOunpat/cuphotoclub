// Normalize any stored image reference (bare key, /images/... path, or full URL)
// down to the underlying R2 object key. Returns null when no key can be derived.
export function normalizeR2Key(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed)
      const match = url.pathname.match(/\/images\/(.+)$/)
      return match?.[1] ? decodeURIComponent(match[1]) : null
    } catch {
      return null
    }
  }
  return trimmed.replace(/^\/images\//, '').replace(/^\/+/, '') || null
}
