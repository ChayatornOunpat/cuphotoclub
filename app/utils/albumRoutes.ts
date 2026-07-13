export function decodePathSegment(value: string): string {
  let current = value
  for (let i = 0; i < 2; i++) {
    try {
      const decoded = decodeURIComponent(current)
      if (decoded === current) break
      current = decoded
    } catch {
      break
    }
  }
  return current
}

export function albumRoutePath(slug: string): string {
  return `/albums/${decodePathSegment(slug)}`
}

export function adminAlbumRoutePath(slug: string): string {
  return `/admin/albums/${decodePathSegment(slug)}`
}
