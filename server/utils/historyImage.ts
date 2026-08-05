// Decode the single managed image used by the homepage History section.
// Drizzle normally returns JSON-mode strings already parsed, but tolerate
// legacy/raw rows so one malformed setting cannot break the landing page.
export function decodeHistoryImage(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed.trim() : ''
  } catch {
    return raw.trim()
  }
}
