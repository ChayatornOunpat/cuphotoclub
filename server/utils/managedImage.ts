// Decode a single managed landing-page image setting. Drizzle normally
// returns JSON-mode strings already parsed, but tolerate legacy/raw rows so a
// malformed setting cannot break the public landing page.
export function decodeManagedImage(raw: unknown): string {
  if (typeof raw !== 'string') return ''

  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'string' ? parsed.trim() : ''
  } catch {
    return raw.trim()
  }
}
