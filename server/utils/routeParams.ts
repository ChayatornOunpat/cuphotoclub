export function decodeRouteSegment(value: string): string {
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
