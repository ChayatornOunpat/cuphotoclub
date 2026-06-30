/** Returns an error message string, or null if the input is valid. */
export function validatePost(b: Record<string, unknown>): string | null {
  if (!b || typeof b !== 'object') return 'Invalid body'
  if (!String(b.title ?? '').trim()) return 'Title is required'
  if (!String(b.tag ?? '').trim()) return 'Tag is required'
  if (!String(b.date ?? '').trim()) return 'Display date is required'
  if (!String(b.image ?? '').trim()) return 'Image URL is required'
  if (!String(b.excerpt ?? '').trim()) return 'Excerpt is required'
  if (!String(b.body ?? '').trim()) return 'Body is required'
  return null
}
