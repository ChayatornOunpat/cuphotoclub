// Decode the `heroImages` settings row. The column is JSON-mode so it normally
// comes back as an array already, but tolerate legacy/corrupted string rows
// instead of letting one bad row 500 every endpoint that reads it.
export function decodeHeroImages(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === 'string')
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '[]')
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
    } catch {
      return []
    }
  }
  return []
}
